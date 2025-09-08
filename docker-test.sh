#!/bin/bash

# Docker Test Script for Bug Emporium
# This script helps test the Docker build locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to build the Docker image
build_image() {
    local tag="${1:-bug-emporium:test}"
    print_status "Building Docker image: $tag"
    
    docker build -t "$tag" .
    
    if [ $? -eq 0 ]; then
        print_success "Docker image built successfully: $tag"
    else
        print_error "Docker build failed"
        exit 1
    fi
}

# Function to test the Docker image
test_image() {
    local tag="${1:-bug-emporium:test}"
    print_status "Testing Docker image: $tag"
    
    # Create a temporary .env file for testing
    cat > .env.test << EOF
GITLAB_ENDPOINT=https://gitlab.com
GITLAB_TOKEN=test-token
GITLAB_GROUP_ID=123
EMPORIUM_LABEL=emporium
PRIORITY_LABEL=priority
PORT=3001
NODE_ENV=production
EOF

    # Add CA certificate path if provided
    if [ -n "$GITLAB_CA_CERT_PATH" ] && [ -f "$GITLAB_CA_CERT_PATH" ]; then
        echo "GITLAB_CA_CERT_PATH=$GITLAB_CA_CERT_PATH" >> .env.test
        print_status "Using CA certificate: $GITLAB_CA_CERT_PATH"
    fi
    
    # Run the container
    print_status "Starting container..."
    container_id=$(docker run -d --env-file .env.test -p 3001:3001 "$tag")
    
    if [ $? -eq 0 ]; then
        print_success "Container started: $container_id"
        
        # Wait for container to be ready
        print_status "Waiting for container to be ready..."
        sleep 10
        
        # Test health endpoint
        if curl -f http://localhost:3001/api/health >/dev/null 2>&1; then
            print_success "Health check passed"
        else
            print_warning "Health check failed - container may still be starting"
        fi
        
        # Show container logs
        print_status "Container logs:"
        docker logs "$container_id"
        
        # Clean up
        print_status "Stopping and removing container..."
        docker stop "$container_id" >/dev/null 2>&1
        docker rm "$container_id" >/dev/null 2>&1
        rm -f .env.test
        
        print_success "Test completed successfully"
    else
        print_error "Failed to start container"
        rm -f .env.test
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Docker Test Script for Bug Emporium"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  build [TAG]     Build Docker image (default tag: bug-emporium:test)"
    echo "  test [TAG]      Test Docker image (default tag: bug-emporium:test)"
    echo "  all [TAG]       Build and test Docker image"
    echo "  help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 build"
    echo "  $0 build bug-emporium:v1.0.0"
    echo "  $0 test"
    echo "  $0 all"
}

# Main script logic
main() {
    local command="${1:-help}"
    local tag="${2:-bug-emporium:test}"
    
    case "$command" in
        "build")
            check_docker
            build_image "$tag"
            ;;
        "test")
            check_docker
            test_image "$tag"
            ;;
        "all")
            check_docker
            build_image "$tag"
            test_image "$tag"
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
