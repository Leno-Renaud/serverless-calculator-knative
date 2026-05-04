# Automation Guide

## Launch Script
Run the script from the root directory serverless-calculator:
!! if you use knative, you will need your docker username
```bash
bash automation/deploy.sh
```

## How to find the URL
- **k3s**: `http://localhost:8080`
- **Knative**: `http://frontend.default.<YOUR_IP>.sslip.io:8080/` (displayed at the end of the script)

## Basic Commands
```bash
# Check Pods
kubectl get pods -n calculator (k3s)
kubectl get pods -n default (knative)

# Check Knative Services
kubectl get ksvc

# Port Forwarding (manual)
kubectl port-forward -n calculator service/frontend 8080:80 (k3s)
kubectl -n kourier-system port-forward svc/kourier 8080:80 (knative)
```
