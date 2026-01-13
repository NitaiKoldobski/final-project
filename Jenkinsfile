pipeline {
  agent none

  options {
    disableConcurrentBuilds()
  }

  environment {
    REGISTRY     = "ghcr.io"
    OWNER        = "nitaikoldobski"   // lowercase for GHCR
    BACKEND_IMG  = "${REGISTRY}/${OWNER}/final-project-backend"
    FRONTEND_IMG = "${REGISTRY}/${OWNER}/final-project-frontend"
  }

  stages {

    stage("Checkout") {
      agent any
      steps {
        checkout scm
        sh '''
          set -e
          echo "BRANCH: ${BRANCH_NAME:-unknown}"
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

  # keep workspace writable for durable tasks + venv
  securityContext:
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000

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
          env.GIT_SHA = sh(returnStdout: true, script: "cat .gitsha").trim()
          env.TAG_NUM = env.BUILD_NUMBER
          echo "Using tags: num=${env.TAG_NUM} sha=${env.GIT_SHA}"
        }

        // ---- Backend tests (use venv in workspace) ----
        container("python") {
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

        // ---- Frontend tests ----
        container("node") {
          sh """
            set -eux
            cd frontend-app
            node -v
            npm -v
            npm ci
            echo "Frontend tests placeholder ✅"
          """
        }

        // ---- Build + Push images ----
        container("kaniko") {
          sh """
            set -eux
            /kaniko/executor \
              --context=dir://$WORKSPACE/backend-api \
              --dockerfile=$WORKSPACE/backend-api/Dockerfile \
              --destination=${BACKEND_IMG}:${TAG_NUM} \
              --destination=${BACKEND_IMG}:${GIT_SHA} \
              --destination=${BACKEND_IMG}:latest
          """
        }

        container("kaniko") {
          sh """
            set -eux
            /kaniko/executor \
              --context=dir://$WORKSPACE/frontend-app \
              --dockerfile=$WORKSPACE/frontend-app/Dockerfile \
              --destination=${FRONTEND_IMG}:${TAG_NUM} \
              --destination=${FRONTEND_IMG}:${GIT_SHA} \
              --destination=${FRONTEND_IMG}:latest
          """
        }

        // ---- Trivy scan (do not fail pipeline) ----
        container("trivy") {
          sh """
            set +e
            trivy version
            trivy image --timeout 5m --severity HIGH,CRITICAL --no-progress ${BACKEND_IMG}:${GIT_SHA}
            trivy image --timeout 5m --severity HIGH,CRITICAL --no-progress ${FRONTEND_IMG}:${GIT_SHA}
            exit 0
          """
        }

        archiveArtifacts artifacts: "Jenkinsfile,.gitsha,devops-infra/**", allowEmptyArchive: true
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

  securityContext:
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000

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
          def envName = (env.BRANCH_NAME == "main") ? "prod" : "dev"
          env.DEPLOY_ENV = envName
          env.NAMESPACE  = (envName == "prod") ? "todo-prod" : "todo"
          echo "Deploying env=${env.DEPLOY_ENV} namespace=${env.NAMESPACE}"
        }

        container("kubectl") {
          sh """
            set -eux

            # Rollback automatically if something fails in this stage:
            trap 'echo "Deploy failed -> rollback"; kubectl -n ${NAMESPACE} rollout undo deploy/backend || true; kubectl -n ${NAMESPACE} rollout undo deploy/frontend || true' ERR

            kubectl version --client=true

            # Your repo path:
            kubectl apply -k devops-infra/kustomize/overlays/${DEPLOY_ENV}

            kubectl -n ${NAMESPACE} rollout status deploy/backend --timeout=180s
            kubectl -n ${NAMESPACE} rollout status deploy/frontend --timeout=180s
          """
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
  securityContext:
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
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
          sh """
            set -eux
            kubectl -n ${NAMESPACE} run curl-check --rm -i --restart=Never \
              --image=curlimages/curl:8.5.0 \
              -- curl -sSf http://backend:5000/health

            kubectl -n ${NAMESPACE} get pods -o wide
          """
        }
      }
    }
  }
}
