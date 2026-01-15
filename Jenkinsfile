pipeline {
  agent { label 'kaniko' }

  environment {
    GHCR_USER = "NitaiKoldobski"
    REPO_URL  = "https://github.com/NitaiKoldobski/final-project.git"

    BACKEND_IMAGE  = "ghcr.io/${GHCR_USER}/final-project-backend"
    FRONTEND_IMAGE = "ghcr.io/${GHCR_USER}/final-project-frontend"

    TAG = "${env.BUILD_NUMBER}"
  }

  stages {
    stage('Checkout') {
      steps {
        container('git') {
          withCredentials([string(credentialsId: 'github-token', variable: 'GHTOKEN')]) {
            sh '''
              rm -rf repo
              git clone https://${GHTOKEN}@github.com/NitaiKoldobski/final-project.git repo
              cd repo
              git rev-parse --short HEAD
            '''
          }
        }
      }
    }

    stage('Build & Push Backend') {
      steps {
        container('kaniko') {
          sh """
            /kaniko/executor \
              --context=dir://repo/backend-api \
              --dockerfile=repo/backend-api/Dockerfile \
              --destination=${BACKEND_IMAGE}:${TAG} \
              --destination=${BACKEND_IMAGE}:latest
          """
        }
      }
    }

    stage('Build & Push Frontend') {
      steps {
        container('kaniko') {
          sh """
            /kaniko/executor \
              --context=dir://repo/frontend-app \
              --dockerfile=repo/frontend-app/Dockerfile \
              --destination=${FRONTEND_IMAGE}:${TAG} \
              --destination=${FRONTEND_IMAGE}:latest
          """
        }
      }
    }
  }
}
