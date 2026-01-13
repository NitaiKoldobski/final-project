// Jenkinsfile (Declarative Pipeline) - Kubernetes agents (kaniko + trivy + kubectl)
// Fixes included:
// 1) Uses ServiceAccount jenkins-deployer only where needed (Deploy stage)
// 2) Avoids pod-level runAsUser/fsGroup that breaks Kaniko ("chown /: operation not permitted")
// 3) Uses a Python venv to avoid pip permission issues
// 4) Removes invalid `post { failure { steps { ... }}}` (caused "NoSuchMethodError: steps")

pipeline {
  agent none

  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '25'))
  }

  parameters {
    choice(name: 'ENV', choices: ['dev', 'prod'], description: 'Which kustomize overlay to deploy')
    string(name: 'NAMESPACE', defaultValue: 'todo', description: 'Kubernetes namespace for the app')
    booleanParam(name: 'RUN_TRIVY', defaultValue: true, description: 'Run Trivy image scan')
  }

  environment {
    REGISTRY          = 'ghcr.io/nitaikoldobski'
    BACKEND_IMAGE     = "${REGISTRY}/final-project-backend"
    FRONTEND_IMAGE    = "${REGISTRY}/final-project-frontend"

    // K8s manifests paths (your repo layout)
    RBAC_FILE         = 'devops-infra/kubernetes/jenkins/jenkins-deployer-rbac.yaml'
    KUSTOMIZE_OVERLAY = "devops-infra/kustomize/overlays/${params.ENV}"

    // Speed up / reduce noise
    PIP_DISABLE_PIP_VERSION_CHECK = '1'
  }

  stages {
    stage('Checkout') {
      agent {
        kubernetes {
          defaultContainer 'jnlp'
          yaml """
apiVersion: v1
kind: Pod
spec:
  restartPolicy: Never
  containers:
    - name: jnlp
      image: jenkins/inbound-agent:3345.v03dee9b_f88fc-1
"""
        }
      }
      steps {
        checkout scm

        script {
          def sha = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
          def branch = env.BRANCH_NAME ?: 'unknown'
          writeFile file: '.gitsha', text: sha
          echo "BRANCH: ${branch}"
          echo "GIT_SHA: ${sha}"
        }

        // Stash everything once; later stages just unstash.
        stash name: 'src', includes: '**/*', useDefaultExcludes: false
      }
    }

    stage('Build + Test + Scan + Push') {
      agent {
        kubernetes {
          defaultContainer 'jnlp'
          yaml """
apiVersion: v1
kind: Pod
spec:
  restartPolicy: Never
  volumes:
    - name: docker-config
      secret:
        secretName: ghcr-docker-config
  containers:
    - name: python
      image: python:3.11-slim
      command: ["sh","-c","cat"]
      tty: true

    - name: node
      image: node:20-alpine
      command: ["sh","-c","cat"]
      tty: true

    - name: kaniko
      image: gcr.io/kaniko-project/executor:debug
      command: ["sh","-c","cat"]
      tty: true
      volumeMounts:
        - name: docker-config
          mountPath: /kaniko/.docker

    - name: trivy
      image: aquasec/trivy:latest
      command: ["sh","-c","cat"]
      tty: true
      volumeMounts:
        - name: docker-config
          mountPath: /root/.docker
"""
        }
      }

      steps {
        unstash 'src'

        script {
          env.GIT_SHA = readFile('.gitsha').trim()
          env.BUILD_TAG_NUM = "${env.BUILD_NUMBER}"
          echo "Using tags: num=${env.BUILD_TAG_NUM} sha=${env.GIT_SHA}"
        }

        // ---- Backend tests (Python) ----
        container('python') {
          sh """
            set -eux
            cd backend-api
            python -V
            python -m venv .venv
            . .venv/bin/activate
            pip install --upgrade pip
            pip install -r requirements.txt
            echo "Backend tests placeholder ✅"
          """
        }

        // ---- Frontend tests (Node) ----
        container('node') {
          sh """
            set -eux
            cd frontend-app
            node -v
            npm -v
            npm ci
            echo "Frontend tests placeholder ✅"
          """
        }

        // ---- Build & Push images (Kaniko) ----
        container('kaniko') {
          sh """
            set -eux

            /kaniko/executor \
              --context=dir://$WORKSPACE/backend-api \
              --dockerfile=$WORKSPACE/backend-api/Dockerfile \
              --destination=${BACKEND_IMAGE}:${BUILD_TAG_NUM} \
              --destination=${BACKEND_IMAGE}:${GIT_SHA} \
              --destination=${BACKEND_IMAGE}:latest

            /kaniko/executor \
              --context=dir://$WORKSPACE/frontend-app \
              --dockerfile=$WORKSPACE/frontend-app/Dockerfile \
              --destination=${FRONTEND_IMAGE}:${BUILD_TAG_NUM} \
              --destination=${FRONTEND_IMAGE}:${GIT_SHA} \
              --destination=${FRONTEND_IMAGE}:latest
          """
        }

        // ---- Scan images (Trivy) ----
        script {
          if (params.RUN_TRIVY) {
            container('trivy') {
              sh """
                set -eux
                trivy version

                # keep it informative (doesn't fail build by default)
                trivy image --timeout 5m --severity HIGH,CRITICAL --no-progress ${BACKEND_IMAGE}:${GIT_SHA} | tee trivy-backend.txt
                trivy image --timeout 5m --severity HIGH,CRITICAL --no-progress ${FRONTEND_IMAGE}:${GIT_SHA} | tee trivy-frontend.txt
              """
            }
          } else {
            echo "RUN_TRIVY=false -> skipping Trivy scans"
          }
        }
      }

      post {
        always {
          archiveArtifacts artifacts: 'trivy-*.txt,.gitsha', allowEmptyArchive: true
        }
      }
    }

    stage('Deploy') {
      agent {
        kubernetes {
          defaultContainer 'jnlp'
          yaml """
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-deployer
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
        unstash 'src'

        container('kubectl') {
          sh """
            set -eux

            echo "Deploying env=${params.ENV} namespace=${params.NAMESPACE}"

            # 1) Ensure Jenkins deployer SA + RBAC exists (safe to re-apply)
            kubectl apply -f ${RBAC_FILE}

            # 2) Deploy app manifests via kustomize overlay
            kubectl apply -k ${KUSTOMIZE_OVERLAY}

            # Optional basic rollout checks (won't break if names differ)
            kubectl -n ${params.NAMESPACE} get all || true
          """
        }
      }
    }

    stage('Verify') {
      agent {
        kubernetes {
          defaultContainer 'jnlp'
          yaml """
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-deployer
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
            kubectl -n ${params.NAMESPACE} get ingress || true
          """
        }
      }
    }
  }

  post {
    success {
      echo "✅ Pipeline finished successfully"
    }
    failure {
      echo "❌ Pipeline failed - check stage logs above"
    }
    always {
      echo "Build URL: ${env.BUILD_URL}"
    }
  }
}
