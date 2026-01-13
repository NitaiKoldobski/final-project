pipeline {
  agent none

  options {
    disableConcurrentBuilds()
  }

  environment {
    REGISTRY = "ghcr.io"
    OWNER    = "nitaikoldobski"  // MUST be lowercase for GHCR
    BACKEND_IMG  = "${REGISTRY}/${OWNER}/final-project-backend"
    FRONTEND_IMG = "${REGISTRY}/${OWNER}/final-project-frontend"
  }

  stages {

    stage("Checkout") {
      agent { label "jenkins-jenkins-agent" }
      steps {
        checkout scm
        sh '''
          set -e
          echo "BRANCH: ${BRANCH_NAME}"
          git rev-parse --short HEAD > .gitsha
          echo "GIT_SHA=$(cat .gitsha)"
        '''
        stash name: "src", includes: "**/*"
      }
    }

    stage("Build + Test + Scan + Push") {
      agent {
        kubernetes {
          yaml """
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-deployer
  containers:
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command: ["sh", "-c", "cat"]
    tty: true
    volumeMounts:
    - name: docker-config
      mountPath: /kaniko/.docker

  - name: python
    image: python:3.11-slim
    command: ["sh", "-c", "cat"]
    tty: true

  - name: node
    image: node:20-alpine
    command: ["sh", "-c", "cat"]
    tty: true

  - name: trivy
    image: aquasec/trivy:latest
    command: ["sh", "-c", "cat"]
    tty: true
    volumeMounts:
    - name: docker-config
      mountPath: /root/.docker

  volumes:
  - name: docker-config
    secret:
      secretName: ghcr-docker-config
"""
        }
      }

      steps {
        unstash "src"

        script {
          env.GIT_SHA   = readFile(".gitsha").trim()
          env.TAG_NUM   = env.BUILD_NUMBER
        }

        // Backend tests
        container("python") {
          sh '''
            set -e
            cd backend-api
            python -V
            pip install -r requirements.txt
            echo "Backend tests placeholder ✅"
          '''
        }

        // Frontend tests
        container("node") {
          sh '''
            set -e
            cd frontend-app
            node -v
            npm -v
            npm ci || npm install
            echo "Frontend tests placeholder ✅"
          '''
        }

        // Build+Push backend
        container("kaniko") {
          sh '''
            set -e
            /kaniko/executor \
              --context=dir://$WORKSPACE/backend-api \
              --dockerfile=$WORKSPACE/backend-api/Dockerfile \
              --destination=${BACKEND_IMG}:${TAG_NUM} \
              --destination=${BACKEND_IMG}:${GIT_SHA} \
              --destination=${BACKEND_IMG}:latest
          '''
        }

        // Build+Push frontend
        container("kaniko") {
          sh '''
            set -e
            /kaniko/executor \
              --context=dir://$WORKSPACE/frontend-app \
              --dockerfile=$WORKSPACE/frontend-app/Dockerfile \
              --destination=${FRONTEND_IMG}:${TAG_NUM} \
              --destination=${FRONTEND_IMG}:${GIT_SHA} \
              --destination=${FRONTEND_IMG}:latest
          '''
        }

        // Trivy scan (bonus) - do not fail build
        container("trivy") {
          sh '''
            trivy version
            trivy image --timeout 5m --severity HIGH,CRITICAL --no-progress ${BACKEND_IMG}:${GIT_SHA} || true
            trivy image --timeout 5m --severity HIGH,CRITICAL --no-progress ${FRONTEND_IMG}:${GIT_SHA} || true
          '''
        }
      }

      post {
        always {
          archiveArtifacts artifacts: "Jenkinsfile,.gitsha,devops-infra/**", allowEmptyArchive: true
        }
      }
    }

    stage("Deploy") {
      agent {
        kubernetes {
          yaml """
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-deployer
  containers:
  - name: kubectl
    image: bitnami/kubectl:latest
    command: ["sh", "-c", "cat"]
    tty: true
"""
        }
      }

      steps {
        unstash "src"

        script {
          env.DEPLOY_ENV = (env.BRANCH_NAME == "main") ? "prod" : "dev"
          env.NAMESPACE  = (env.DEPLOY_ENV == "prod") ? "todo-prod" : "todo"
          echo "Deploying env=${env.DEPLOY_ENV} namespace=${env.NAMESPACE}"
        }

        container("kubectl") {
          sh '''
            set -e
            kubectl version --client=true

            # Apply kustomize overlay (creates/updates everything)
            kubectl apply -k devops-infra/kustomize/overlays/${DEPLOY_ENV}

            # Wait for rollout
            kubectl -n ${NAMESPACE} rollout status deploy/backend --timeout=180s
            kubectl -n ${NAMESPACE} rollout status deploy/frontend --timeout=180s
          '''
        }
      }
    }

    stage("Verify") {
      agent {
        kubernetes {
          yaml """
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-deployer
  containers:
  - name: kubectl
    image: bitnami/kubectl:latest
    command: ["sh", "-c", "cat"]
    tty: true
"""
        }
      }

      steps {
        container("kubectl") {
          sh '''
            set -e

            kubectl -n ${NAMESPACE} run curl-check --rm -i --restart=Never \
              --image=curlimages/curl:8.5.0 \
              -- curl -sSf http://backend:5000/health

            kubectl -n ${NAMESPACE} get pods -o wide
          '''
        }
      }
    }
  }

  post {
    failure {
      script {
        // Rollback using a scripted podTemplate (works even with agent none)
        podTemplate(yaml: """
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-deployer
  containers:
  - name: kubectl
    image: bitnami/kubectl:latest
    command: ["sh", "-c", "cat"]
    tty: true
""") {
          node(POD_LABEL) {
            container("kubectl") {
              sh '''
                echo "Rolling back in namespace ${NAMESPACE}..."
                kubectl -n ${NAMESPACE} rollout undo deploy/backend || true
                kubectl -n ${NAMESPACE} rollout undo deploy/frontend || true
              '''
            }
          }
        }
      }
    }
  }
}
