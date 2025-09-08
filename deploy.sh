#!/bin/bash

# Bug Emporium Deployment Script
# This script helps deploy Bug Emporium to Kubernetes/OpenShift

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
NAMESPACE="bug-emporium"
RELEASE_NAME="bug-emporium"
IMAGE_TAG="latest"
CHART_PATH="./helm/bug-emporium"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists kubectl; then
        print_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    
    if ! command_exists helm; then
        print_error "Helm is not installed. Please install Helm first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to create namespace
create_namespace() {
    print_status "Creating namespace: $NAMESPACE"
    
    if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
        print_warning "Namespace $NAMESPACE already exists"
    else
        kubectl create namespace "$NAMESPACE"
        print_success "Namespace $NAMESPACE created"
    fi
}

# Function to deploy with Helm
deploy_with_helm() {
    print_status "Deploying Bug Emporium with Helm..."
    
    # Check if values are provided
    if [ -z "$GITLAB_TOKEN" ]; then
        print_error "GITLAB_TOKEN environment variable is required"
        exit 1
    fi
    
    if [ -z "$GITLAB_GROUP_ID" ]; then
        print_error "GITLAB_GROUP_ID environment variable is required"
        exit 1
    fi
    
    # Prepare Helm values
    local helm_values="--set image.tag=$IMAGE_TAG"
    helm_values="$helm_values --set gitlab.token=$GITLAB_TOKEN"
    helm_values="$helm_values --set gitlab.groupId=$GITLAB_GROUP_ID"
    helm_values="$helm_values --set gitlab.endpoint=${GITLAB_ENDPOINT:-https://gitlab.com}"
    helm_values="$helm_values --set gitlab.emporiumLabel=${EMPORIUM_LABEL:-emporium}"
    helm_values="$helm_values --set gitlab.priorityLabel=${PRIORITY_LABEL:-priority}"
    helm_values="$helm_values --set route.host=${ROUTE_HOST:-bug-emporium.apps.your-domain.com}"
    
    # Add CA certificate if provided
    if [ -n "$GITLAB_CA_CERT_PATH" ] && [ -f "$GITLAB_CA_CERT_PATH" ]; then
        local ca_cert_b64=$(base64 -i "$GITLAB_CA_CERT_PATH" | tr -d '\n')
        helm_values="$helm_values --set secret.data.GITLAB_CA_CERT=$ca_cert_b64"
        print_status "Using CA certificate: $GITLAB_CA_CERT_PATH"
    fi
    
    # Deploy with Helm
    helm upgrade --install "$RELEASE_NAME" "$CHART_PATH" \
        --namespace "$NAMESPACE" \
        $helm_values \
        --wait --timeout=5m
    
    print_success "Bug Emporium deployed successfully"
}

# Function to show deployment status
show_status() {
    print_status "Deployment status:"
    echo ""
    
    print_status "Pods:"
    kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=bug-emporium
    
    echo ""
    print_status "Services:"
    kubectl get services -n "$NAMESPACE" -l app.kubernetes.io/name=bug-emporium
    
    echo ""
    print_status "Routes:"
    kubectl get routes -n "$NAMESPACE" -l app.kubernetes.io/name=bug-emporium 2>/dev/null || echo "No routes found (not running on OpenShift)"
    
    echo ""
    print_status "Ingress:"
    kubectl get ingress -n "$NAMESPACE" -l app.kubernetes.io/name=bug-emporium 2>/dev/null || echo "No ingress found"
}

# Function to show logs
show_logs() {
    print_status "Showing logs for Bug Emporium pods:"
    kubectl logs -n "$NAMESPACE" -l app.kubernetes.io/name=bug-emporium --tail=50
}

# Function to delete deployment
delete_deployment() {
    print_warning "This will delete the Bug Emporium deployment. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Deleting Bug Emporium deployment..."
        helm uninstall "$RELEASE_NAME" -n "$NAMESPACE" || true
        kubectl delete namespace "$NAMESPACE" || true
        print_success "Bug Emporium deployment deleted"
    else
        print_status "Deletion cancelled"
    fi
}

# Function to show help
show_help() {
    echo "Bug Emporium Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy     Deploy Bug Emporium (default)"
    echo "  status     Show deployment status"
    echo "  logs       Show application logs"
    echo "  delete     Delete the deployment"
    echo "  help       Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  GITLAB_TOKEN        GitLab access token (required)"
    echo "  GITLAB_GROUP_ID     GitLab group ID (required)"
    echo "  GITLAB_ENDPOINT     GitLab endpoint (default: https://gitlab.com)"
    echo "  GITLAB_CA_CERT_PATH Path to CA certificate file for self-signed GitLab"
    echo "  EMPORIUM_LABEL      Emporium label (default: emporium)"
    echo "  PRIORITY_LABEL      Priority label (default: priority)"
    echo "  ROUTE_HOST          OpenShift route host"
    echo "  IMAGE_TAG           Docker image tag (default: latest)"
    echo "  NAMESPACE           Kubernetes namespace (default: bug-emporium)"
    echo ""
    echo "Examples:"
    echo "  $0 deploy"
    echo "  GITLAB_TOKEN=xxx GITLAB_GROUP_ID=123 $0 deploy"
    echo "  GITLAB_CA_CERT_PATH=/path/to/ca.pem $0 deploy"
    echo "  $0 status"
    echo "  $0 logs"
    echo "  $0 delete"
}

# Main script logic
main() {
    local command="${1:-deploy}"
    
    case "$command" in
        "deploy")
            check_prerequisites
            create_namespace
            deploy_with_helm
            show_status
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        "delete")
            delete_deployment
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
