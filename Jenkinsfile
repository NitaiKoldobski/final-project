pipeline {
  agent none

  environment {
    REGISTRY = "ghcr.io"
    OWNER    = "NitaiKoldobski"
    IMAGE    = "final-project-backend"
    TAG      = "build-${BUILD_NUMBER}"
  }

  stages {
    stage("Build+Push (Kaniko)") {
      agent {
        kubernetes {
          label 'kaniko'
          defaultContainer 'kaniko'
          yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command: ["sleep"]
    args: ["infinity"]
    volumeMounts:
    - name: docker-config
      mountPath: /kaniko/.docker
  volumes:
  - name: docker-config
    secret:
      secretName: ghcr-docker-config
"""
        }
      }

      stage("Checkout") {
  steps {
    container('kaniko') {
      sh '''
        apk add --no-cache git
        rm -rf src
        git clone https://github.com/NitaiKoldobski/final-project.git src
        ls -la src
      '''
    }
  }
}
