#!/bin/bash

# Email Reader - Deployment Script
# Builds and starts both backend and frontend services

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    lsof -i :$port 2>/dev/null | grep LISTEN >/dev/null
    return $?
}

# Function to kill process on a specific port
kill_port() {
    local port=$1
    print_info "Killing process on port $port..."
    lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null || true
}

# Function to check and clean up ports
check_and_clean_ports() {
    print_info "Checking port availability..."

    local ports=(3000 3001 4173 5173)
    local ports_in_use=()

    # Check which ports are in use
    for port in "${ports[@]}"; do
        if check_port $port; then
            ports_in_use+=($port)
        fi
    done

    # If no ports in use, continue
    if [ ${#ports_in_use[@]} -eq 0 ]; then
        print_success "All required ports are available"
        return 0
    fi

    # Ports are in use - handle based on FORCE_CLEAN flag
    print_warning "The following ports are in use: ${ports_in_use[*]}"
    echo ""

    if [ "$FORCE_CLEAN" = true ]; then
        print_info "Force clean enabled. Killing processes..."
        for port in "${ports_in_use[@]}"; do
            kill_port $port
        done
        sleep 1
        print_success "Ports cleaned up successfully"
    else
        read -p "Do you want to kill processes on these ports? (y/n) " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            for port in "${ports_in_use[@]}"; do
                kill_port $port
            done
            sleep 1
            print_success "Ports cleaned up successfully"
        else
            print_error "Cannot proceed with ports in use. Exiting..."
            exit 1
        fi
    fi
}

# Function to check if required files exist
check_requirements() {
    print_info "Checking requirements..."

    if [ ! -f "backend/.env" ]; then
        print_error "backend/.env file not found!"
        echo "Please create backend/.env with required environment variables."
        exit 1
    fi

    if [ ! -f "frontend/.env" ]; then
        print_warning "frontend/.env file not found. Using defaults."
    fi

    print_success "Requirements check passed"
}

# Function to install dependencies
install_dependencies() {
    print_info "Installing dependencies..."
    npm run install:all
    print_success "Dependencies installed"
}

# Function to build services
build_services() {
    print_info "Building backend..."
    cd backend
    npm run build
    cd ..
    print_success "Backend built successfully"

    print_info "Building frontend..."
    cd frontend
    npm run build
    cd ..
    print_success "Frontend built successfully"
}

# Function to start services
start_services() {
    print_info "Starting services..."
    print_info "Backend will run on http://localhost:3001"
    print_info "Frontend will run on http://localhost:4173 (Vite preview)"
    echo ""
    print_warning "Press Ctrl+C to stop all services"
    echo ""

    npm run start:prod
}

# Main deployment flow
main() {
    echo ""
    echo "================================================"
    echo "   Email Reader - Deployment Script"
    echo "================================================"
    echo ""

    # Parse command line arguments
    SKIP_DEPS=false
    SKIP_BUILD=false
    FORCE_CLEAN=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --force-clean)
                FORCE_CLEAN=true
                shift
                ;;
            --help)
                echo "Usage: ./deploy.sh [options]"
                echo ""
                echo "Options:"
                echo "  --skip-deps     Skip dependency installation"
                echo "  --skip-build    Skip build step (start existing builds)"
                echo "  --force-clean   Automatically kill processes on required ports"
                echo "  --help          Show this help message"
                echo ""
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    check_requirements
    check_and_clean_ports

    if [ "$SKIP_DEPS" = false ]; then
        install_dependencies
    else
        print_warning "Skipping dependency installation"
    fi

    if [ "$SKIP_BUILD" = false ]; then
        build_services
    else
        print_warning "Skipping build step"
    fi

    echo ""
    print_success "Build completed successfully!"
    echo ""

    start_services
}

# Run main function
main "$@"
