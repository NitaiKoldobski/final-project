pipeline {
  agent none

  options {
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '25'))
    skipDefaultCheckout(true)
    timestamps()
  }

  parameters {
    choice(
      name: 'ENV',
      choices: ['dev', 'prod'],
      description: 'Which kustomize overlay to deploy'
    )
    string(
      name: 'NAMESPACE',
      defaultValue: 'todo',
      description: 'Kubernetes namespace'
    )
    booleanParam(
      name: 'RUN_TRIVY',
      defaultValue: true,
      description: 'Run Trivy image scan'
    )
  }

  environment {
    REGISTRY          = 'ghcr.io/nitaikoldobski'
    BACKEND_IMAGE     = "${REGISTRY}/final-project-backend"
    FRONTEND_IMAGE    = "${REGISTRY}/final-project-frontend"

    RBAC_FILE         = 'devops-infra/kubernetes/jenkins/jenkins-deployer-rbac.yaml'
    KUSTOMIZE_OVERLAY = "devops-infra/kustomize/overlays/${params.ENV}"
  }

  stages {

    /* ===================================================== */
    /* ===================== CHECKOUT ====================== */
    /* ===================================================== */

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
        deleteDir()
        checkout scm

        script {
          def sha = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
          writeFile file: '.gitsha', text: sha
          echo "GIT_SHA: ${sha}"
        }

        stash name: 'src', includes: '**/*', excludes: '.git/**'
      }
    }

    /* ===================================================== */
    /* ============ BUILD + TEST + SCAN + PUSH ============== */
    /* ===================================================== */

    stage('Build + Test + Scan + Push') {
      agent {
        kubernetes {
          defaultContainer 'jnlp'
          yaml """
apiVersion: v1
kind: Pod
spec:
  restartPolicy: Never
  securityContext:
    fsGroup: 1000

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
      securityContext:
        runAsUser: 0
        runAsGroup: 0
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
        deleteDir()
        unstash 'src'

        script {
          env.GIT_SHA = readFile('.gitsha').trim()
          env.BUILD_TAG_NUM = env.BUILD_NUMBER
          echo "Tags: ${BUILD_TAG_NUM}, ${GIT_SHA}"
        }

        /* ---------- Backend tests ---------- */
        container('python') {
          sh """
            set -eux
            cd backend-api
            python -m venv .venv
            . .venv/bin/activate
            pip install --upgrade pip
            pip install -r requirements.txt
            echo "Backend tests OK"
          """
        }

        /* ---------- Frontend tests ---------- */
        container('node') {
          sh """
            set -eux
            cd frontend-app
            npm ci
            echo "Frontend tests OK"
          """
        }

        /* ---------- Build & push images ---------- */
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

        /* ---------- Trivy scan ---------- */
        script {
          if (params.RUN_TRIVY) {
            container('trivy') {
              sh """
                set -eux
                trivy image --timeout 5m --severity HIGH,CRITICAL --no-progress ${BACKEND_IMAGE}:${GIT_SHA} | tee trivy-backend.txt
                trivy image --timeout 5m --severity HIGH,CRITICAL --no-progress ${FRONTEND_IMAGE}:${GIT_SHA} | tee trivy-frontend.txt
              """
            }
          }
        }
      }

      post {
        always {
          archiveArtifacts artifacts: 'trivy-*.txt,.gitsha', allowEmptyArchive: true
        }
      }
    }

    /* ===================================================== */
    /* ====================== DEPLOY ======================= */
    /* ===================================================== */

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
      image: bitnami/kubectl:1.30.0
      command: ["sh","-c","cat"]
      tty: true
"""
        }
      }

      steps {
        deleteDir()
        unstash 'src'

        container('kubectl') {
          sh """
            set -eux
            kubectl apply -f ${RBAC_FILE}
            kubectl apply -k ${KUSTOMIZE_OVERLAY}
            kubectl -n ${params.NAMESPACE} get all
          """
        }
      }
    }

    /* ===================================================== */
    /* ====================== VERIFY ======================= */
    /* ===================================================== */

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
      image: bitnami/kubectl:1.30.0
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
    success { echo "✅ Pipeline finished successfully" }
    failure { echo "❌ Pipeline failed" }
    always  { echo "Build URL: ${env.BUILD_URL}" }
  }
}
