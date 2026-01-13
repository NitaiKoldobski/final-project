// Jenkinsfile (Declarative Pipeline) - fixed:
// 1) No pod-level non-root securityContext in Build stage (Kaniko needs chown)
// 2) Python installs run inside a workspace venv (no permission issues)
// 3) Declarative post{} fixed (no "steps" inside post)
// 4) kubectl pod uses "sh -c cat" so Jenkins can exec commands reliably

pipeline {
  agent none

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  parameters {
    choice(name: 'ENV', choices: ['dev', 'prod'], description: 'Deployment environment')
    string(name: 'NAMESPACE', defaultValue: 'todo', description: 'Kubernetes namespace to deploy into')
  }

  environment {
    REGISTRY = 'ghcr.io/nitaikoldobski'
    BACKEND_IMAGE  = "${REGISTRY}/final-project-backend"
    FRONTEND_IMAGE = "${REGISTRY}/final-project-frontend"

    // Use your existing dockerconfig secret in k8s for Kaniko/Trivy auth
    DOCKERCFG_SECRET = 'ghcr-docker-config'

    // k8s service account that has permissions to deploy to your namespace(s)
    K8S_SA = 'jenkins-deployer'
  }

  stages {
    stage('Checkout') {
      agent {
        kubernetes {
          // uses your default agent template (jnlp only)
          inheritFrom 'default'
        }
      }
      steps {
        checkout scm
        sh '''
          set -e
          echo "BRANCH: ${BRANCH_NAME:-unknown}"
          git rev-parse --short HEAD > .gitsha
          echo "GIT_SHA=$(cat .gitsha)"
        '''
        stash name: 'src', includes: '**/*, .gitsha'
      }
    }

    stage('Build + Test + Scan + Push') {
      agent {
        kubernetes {
          yaml """
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: finel-project-ci-build
spec:
  serviceAccountName: ${K8S_SA}
  restartPolicy: Never

  volumes:
    - name: docker-config
      secret:
        secretName: ${DOCKERCFG_SECRET}
    - name: workspace-volume
      emptyDir: {}

  containers:
    - name: python
      image: python:3.11-slim
      command: ["sh","-c","cat"]
      tty: true
      volumeMounts:
        - name: workspace-volume
          mountPath: /home/jenkins/agent

    - name: node
      image: node:20-alpine
      command: ["sh","-c","cat"]
      tty: true
      volumeMounts:
        - name: workspace-volume
          mountPath: /home/jenkins/agent

    - name: kaniko
      image: gcr.io/kaniko-project/executor:debug
      command: ["sh","-c","cat"]
      tty: true
      # IMPORTANT: allow kaniko to chown while unpacking layers/building
      securityContext:
        runAsUser: 0
      volumeMounts:
        - name: docker-config
          mountPath: /kaniko/.docker
        - name: workspace-volume
          mountPath: /home/jenkins/agent

    - name: trivy
      image: aquasec/trivy:latest
      command: ["sh","-c","cat"]
      tty: true
      volumeMounts:
        - name: docker-config
          mountPath: /root/.docker
        - name: workspace-volume
          mountPath: /home/jenkins/agent
"""
        }
      }

      steps {
        unstash 'src'

        script {
          env.GIT_SHA = sh(script: "cat .gitsha", returnStdout: true).trim()
          env.BUILD_TAG_NUM = "${env.BUILD_NUMBER}"
          echo "Using tags: num=${env.BUILD_TAG_NUM} sha=${env.GIT_SHA}"
        }

        // Backend: venv inside workspace to avoid permission issues
        container('python') {
          sh '''
            set -eux
            cd backend-api
            python -V
            python -m venv .venv
            . .venv/bin/activate
            pip install --upgrade pip
            pip install -r requirements.txt
            echo "Backend tests placeholder ✅"
          '''
        }

        container('node') {
          sh '''
            set -eux
            cd frontend-app
            node -v
            npm -v
            npm ci
            echo "Frontend tests placeholder ✅"
          '''
        }

        // Build + push images (Kaniko)
        container('kaniko') {
          sh """
            set -eux
            /kaniko/executor \
              --context=dir:///home/jenkins/agent/workspace/${JOB_NAME}/backend-api \
              --dockerfile=/home/jenkins/agent/workspace/${JOB_NAME}/backend-api/Dockerfile \
              --destination=${BACKEND_IMAGE}:${BUILD_TAG_NUM} \
              --destination=${BACKEND_IMAGE}:${GIT_SHA} \
              --destination=${BACKEND_IMAGE}:latest

            /kaniko/executor \
              --context=dir:///home/jenkins/agent/workspace/${JOB_NAME}/frontend-app \
              --dockerfile=/home/jenkins/agent/workspace/${JOB_NAME}/frontend-app/Dockerfile \
              --destination=${FRONTEND_IMAGE}:${BUILD_TAG_NUM} \
              --destination=${FRONTEND_IMAGE}:${GIT_SHA} \
              --destination=${FRONTEND_IMAGE}:latest
          """
        }

        // Scan images (Trivy)
        container('trivy') {
          sh """
            set -eux
            trivy version
            trivy image --timeout 5m --severity HIGH,CRITICAL --no-progress ${BACKEND_IMAGE}:${GIT_SHA}
            trivy image --timeout 5m --severity HIGH,CRITICAL --no-progress ${FRONTEND_IMAGE}:${GIT_SHA}
          """
        }
      }

      post {
        always {
          // declarative post must not wrap in "steps { }"
          archiveArtifacts artifacts: '**/*.log, **/trivy*.txt, **/reports/**', allowEmptyArchive: true
        }
      }
    }

    stage('Deploy') {
      agent {
        kubernetes {
          yaml """
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: finel-project-ci-deploy
spec:
  serviceAccountName: ${K8S_SA}
  restartPolicy: Never
  volumes:
    - name: workspace-volume
      emptyDir: {}
  containers:
    - name: kubectl
      image: bitnami/kubectl:latest
      command: ["sh","-c","cat"]
      tty: true
      volumeMounts:
        - name: workspace-volume
          mountPath: /home/jenkins/agent
"""
        }
      }

      steps {
        unstash 'src'

        script {
          env.GIT_SHA = sh(script: "cat .gitsha", returnStdout: true).trim()
          echo "Deploying env=${params.ENV} namespace=${params.NAMESPACE} imageTag=${env.GIT_SHA}"
        }

        container('kubectl') {
          sh """
            set -eux
            kubectl version --client=true

            # Example: apply manifests (adjust paths to YOUR repo)
            # If you have k8s manifests under k8s/ or helm/ — change these lines.
            kubectl create namespace ${params.NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

            kubectl -n ${params.NAMESPACE} apply -f k8s/ || true

            # OPTIONAL: patch images to the new tag if you use fixed Deployments
            # kubectl -n ${params.NAMESPACE} set image deploy/backend backend=${BACKEND_IMAGE}:${GIT_SHA} --record=true
            # kubectl -n ${params.NAMESPACE} set image deploy/frontend frontend=${FRONTEND_IMAGE}:${GIT_SHA} --record=true
          """
        }
      }
    }

    stage('Verify') {
      agent {
        kubernetes {
          yaml """
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: finel-project-ci-verify
spec:
  serviceAccountName: ${K8S_SA}
  restartPolicy: Never
  containers:
    - name: kubectl
      image: bitnami/kubectl:latest
      command: ["sh","-c","cat"]
      tty: true
"""
        }
      }

      steps {
        container('kubectl') {
          sh """
            set -eux
            kubectl -n ${params.NAMESPACE} get pods -o wide
            kubectl -n ${params.NAMESPACE} get svc
          """
        }
      }
    }
  }

  post {
    failure {
      echo "Pipeline failed ❌"
    }
    success {
      echo "Pipeline succeeded ✅"
    }
  }
}
