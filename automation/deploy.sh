#!/bin/bash

set -e

# --- Configuration & State ---
WORKSPACE_ROOT=$(pwd)
TEMP_DIR="/tmp/calc-automation"
mkdir -p "$TEMP_DIR"

# --- Utility Functions ---

exit_with_message() {
    echo -e "\n\033[31mError: $1\033[0m"
    exit 1
}

check_dialog() {
    if ! command -v dialog &> /dev/null; then
        echo "The 'dialog' tool is required but not installed."
        read -p "Do you want to install it? (y/n): " confirm
        if [[ "$confirm" == "y" ]]; then
            if [[ "$PLATFORM" == "mac" ]]; then
                brew install dialog
            else
                sudo apt-get update && sudo apt-get install -y dialog
            fi
        else
            exit_with_message "dialog is required for this script."
        fi
    fi
}

# --- UI Functions ---

prompt_platform() {
    while true; do
        read -rp "Are you on mac or linux? [mac/linux]: " PLATFORM
        case "$PLATFORM" in
            mac|linux)
                break
                ;;
            *)
                echo "Please answer mac or linux."
                ;;
        esac
    done
}

menu_deployment() {
    DEPLOY_TYPE=$(dialog --clear --title "Deployment Type" \
        --menu "How do you want to deploy the calculator?" 10 50 2 \
        "k3s" "Standard Kubernetes (k3s)" \
        "knative" "Serverless (Knative)" \
        3>&1 1>&2 2>&3)
    clear
}

get_github_username() {
    GIT_USERNAME=$(dialog --clear --title "GitHub Username" \
        --inputbox "Enter your GitHub/Docker username for image registry:" 8 50 \
        3>&1 1>&2 2>&3)
    clear
    if [ -z "$GIT_USERNAME" ]; then exit_with_message "Username is required for Knative."; fi
}

# --- Engine Setup ---

setup_engine() {
    if [[ "$PLATFORM" == "mac" ]]; then
        echo "Starting Colima with Kubernetes..."
        if ! command -v colima &> /dev/null; then exit_with_message "Colima not found."; fi
        colima start --kubernetes || echo "Colima already running or failed to start."
    else
        if [[ "$DEPLOY_TYPE" == "k3s" ]]; then
            echo "Assuming k3s server is started via ./startk3sServer.sh as per docs."
        fi
    fi

    if [[ "$DEPLOY_TYPE" == "knative" ]]; then
        echo "Setting up Knative Serving..."
        kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.21.2/serving-crds.yaml
        kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.21.2/serving-core.yaml
        kubectl apply -f https://github.com/knative-extensions/net-kourier/releases/download/knative-v1.21.0/kourier.yaml
        kubectl patch configmap/config-network \
            --namespace knative-serving \
            --type merge \
            --patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'
        kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.21.2/serving-default-domain.yaml
    fi
}

# --- Build & Push Loop ---

build_loop() {
    while true; do
        CHOICES=$(dialog --clear --title "Build Images" \
            --checklist "Select images to build (Space to select, Enter to confirm):" 15 60 4 \
            "frontend" "Frontend Interface" ON \
            "backend" "Backend Orchestrator" ON \
            "worker" "Python Worker" ON \
            "eml" "EML Evaluator" ON \
            3>&1 1>&2 2>&3) || break # Break on Cancel

        if [ -z "$CHOICES" ]; then break; fi

        if [[ "$DEPLOY_TYPE" == "knative" ]]; then
            docker login
        fi

        for CHOICE in $CHOICES; do
            CLEAN_CHOICE=$(echo $CHOICE | sed 's/"//g')
            echo "Building $CLEAN_CHOICE..."
            
            case $CLEAN_CHOICE in
                frontend)
                    DOCKERFILE="./Frontend/calculator-interface/Dockerfile"
                    if [[ "$DEPLOY_TYPE" == "knative" ]]; then DOCKERFILE="./Frontend/calculator-interface/Dockerfile-knative"; fi
                    TAG="frontend:latest"
                    if [[ "$DEPLOY_TYPE" == "knative" ]]; then TAG="docker.io/$GIT_USERNAME/frontend:1.0"; fi
                    docker build -f "$DOCKERFILE" -t "$TAG" ./Frontend/calculator-interface
                    ;;
                backend)
                    TAG="backend:latest"
                    if [[ "$DEPLOY_TYPE" == "knative" ]]; then TAG="docker.io/$GIT_USERNAME/backend:1.0"; fi
                    docker build -t "$TAG" ./backend/calc
                    ;;
                worker)
                    TAG="worker:latest"
                    if [[ "$DEPLOY_TYPE" == "knative" ]]; then TAG="docker.io/$GIT_USERNAME/worker:1.0"; fi
                    docker build -t "$TAG" ./backend/worker
                    ;;
                eml)
                    TAG="eml:latest"
                    if [[ "$DEPLOY_TYPE" == "knative" ]]; then TAG="docker.io/$GIT_USERNAME/eml:1.0"; fi
                    docker build -t "$TAG" ./backend/eml
                    ;;
            esac

            if [[ "$DEPLOY_TYPE" == "knative" ]]; then
                docker push "$TAG"
            elif [[ "$PLATFORM" == "linux" ]]; then
                echo "Importing $TAG into k3s..."
                docker save "$TAG" -o "$TEMP_DIR/$CLEAN_CHOICE.tar"
                sudo k3s ctr images import "$TEMP_DIR/$CLEAN_CHOICE.tar"
            fi
        done
        break
    done
    clear
}

# --- Apply YAML Loop ---

deploy_loop() {
    while true; do
        if [[ "$DEPLOY_TYPE" == "k3s" ]]; then
            FILE="k3s/kdescriptor-$PLATFORM.yaml"
            OPTIONS=("$FILE" "Standard k3s Manifest" ON)
        else
            KNATIVE_CHOICE=$(dialog --clear --title "Knative Configuration" \
                --menu "Which Knative configuration do you want to use?" 10 50 2 \
                "simple" "Basic Scale-to-Zero" \
                "complete" "Advanced Autoscaling & Control" \
                3>&1 1>&2 2>&3)
            clear
            if [[ "$KNATIVE_CHOICE" == "complete" ]]; then
                FILE="knative/complete_control/knative.yaml"
                OPTIONS=("$FILE" "Complete Control Manifest" ON)
            else
                FILE="knative/simple/knative.yaml"
                OPTIONS=("$FILE" "Simple Knative Manifest" ON)
            fi
        fi

        CHOICES=$(dialog --clear --title "Apply Manifests" \
            --checklist "Select manifests to apply:" 12 60 1 \
            "${OPTIONS[@]}" \
            3>&1 1>&2 2>&3) || break

        if [ -z "$CHOICES" ]; then break; fi

        for CHOICE in $CHOICES; do
            CLEAN_FILE=$(echo $CHOICE | sed 's/"//g')
            
            if [[ "$DEPLOY_TYPE" == "knative" ]]; then
                sed "s/DOCKER_USERNAME/$GIT_USERNAME/g" "$CLEAN_FILE" > "$TEMP_DIR/knative-patched.yaml"
                kubectl apply -f "$TEMP_DIR/knative-patched.yaml"
            else
                kubectl apply -f "$CLEAN_FILE"
            fi
        done
        break
    done
    clear
}

# --- Post-Deployment & Forward ---

finalize() {
    echo "Waiting for pods to be ready..."
    if [[ "$DEPLOY_TYPE" == "knative" ]]; then
        kubectl wait --for=condition=Ready ksvc/frontend --timeout=90s || echo "Knative service taking longer than expected..."
        
        if [[ "$PLATFORM" == "mac" ]]; then
            IP=$(ipconfig getifaddr en0)
        else
            IP=$(hostname -I | awk '{print $1}')
        fi
        echo "Patching Knative domain with IP: $IP"
        kubectl patch configmap config-domain -n knative-serving --type merge -p "{\"data\":{\"$IP.sslip.io\":\"\"}}"
        
        echo -e "\n\033[32m--- DEPLOYMENT COMPLETE ---\033[0m"
        echo "URL: http://frontend.default.$IP.sslip.io:8080/"
        echo "Starting port-forward for Kourier..."
        kubectl -n kourier-system port-forward svc/kourier 8080:80 --address 0.0.0.0
    else
        kubectl wait --for=condition=ready pod -l app=frontend -n calculator --timeout=90s || echo "Pods taking longer than expected..."
        
        echo -e "\n\033[32m--- DEPLOYMENT COMPLETE ---\033[0m"
        echo "URL: http://localhost:8080"
        echo "Starting port-forward for Frontend..."
        kubectl port-forward -n calculator service/frontend 8080:80 --address 127.0.0.1
    fi
}

# --- Execution Flow ---

echo "Starting automation deploy script..."
prompt_platform
check_dialog
menu_deployment
if [[ "$DEPLOY_TYPE" == "knative" ]]; then get_github_username; fi

setup_engine
build_loop
deploy_loop
finalize
