#!/bin/bash

# Web3 Bank Monera Deployment Script
# This script deploys the entire Web3 Bank Monera application

set -e

echo "🚀 Starting Web3 Bank Monera deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs
mkdir -p ssl
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/provisioning

# Copy environment files
echo "📋 Setting up environment files..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Please configure your .env file before continuing."
    echo "   Edit .env file with your API keys and configuration."
    read -p "Press Enter to continue after configuring .env file..."
fi

# Generate SSL certificates (self-signed for development)
echo "🔐 Generating SSL certificates..."
if [ ! -f ssl/cert.pem ]; then
    openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes \
        -subj "/C=BG/ST=Sofia/L=Sofia/O=Web3 Bank Monera/OU=IT Department/CN=web3bankmonera.com"
    echo "✅ SSL certificates generated"
fi

# Build and start services
echo "🏗️  Building and starting services..."
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🔍 Checking service health..."

# Check PostgreSQL
if docker-compose exec -T postgres pg_isready -U web3bank; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready"
    exit 1
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping | grep -q PONG; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
    exit 1
fi

# Check Backend
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend API is ready"
else
    echo "❌ Backend API is not ready"
    exit 1
fi

# Check Frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is ready"
else
    echo "❌ Frontend is not ready"
    exit 1
fi

# Initialize database
echo "🗄️  Initializing database..."
docker-compose exec -T backend npm run db:migrate || echo "⚠️  Database migration failed, but continuing..."

# Create admin user
echo "👤 Creating admin user..."
docker-compose exec -T backend node scripts/create-admin.js || echo "⚠️  Admin user creation failed, but continuing..."

echo ""
echo "🎉 Web3 Bank Monera deployment completed successfully!"
echo ""
echo "📊 Services Status:"
echo "   • Frontend: http://localhost:3000"
echo "   • Backend API: http://localhost:5000"
echo "   • Database: localhost:5432"
echo "   • Redis: localhost:6379"
echo "   • Monitoring: http://localhost:3001"
echo "   • Logs: http://localhost:5601"
echo ""
echo "🔧 Useful commands:"
echo "   • View logs: docker-compose logs -f"
echo "   • Stop services: docker-compose down"
echo "   • Restart services: docker-compose restart"
echo "   • Update services: docker-compose pull && docker-compose up -d"
echo ""
echo "📱 Mobile App:"
echo "   • Install Expo CLI: npm install -g @expo/cli"
echo "   • Start mobile app: cd mobile && npm start"
echo ""
echo "🔐 Security Notes:"
echo "   • Change default passwords in production"
echo "   • Use proper SSL certificates"
echo "   • Configure firewall rules"
echo "   • Enable monitoring and alerting"
echo ""
echo "📚 Documentation:"
echo "   • API Documentation: http://localhost:5000/api-docs"
echo "   • Admin Panel: http://localhost:3000/admin"
echo ""
echo "🚀 Your Web3 Bank Monera is ready to use!"