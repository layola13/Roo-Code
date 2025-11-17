#!/bin/bash

echo "Initializing Dashboard Project Structure..."

# Create directory structure
mkdir -p src/app/{(auth),\(dashboard\)/{users,organizations,tasks,telemetry,settings}}
mkdir -p src/app/api
mkdir -p src/components/{ui,layout,dashboard}
mkdir -p src/hooks
mkdir -p src/store
mkdir -p src/types
mkdir -p public

echo "✓ Directory structure created"

# Install dependencies
echo "Installing dependencies..."
npm install

echo "✓ Dependencies installed"

echo ""
echo "Dashboard initialization complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env.local and configure"
echo "2. Run 'npm run dev' to start development server"
echo "3. Backend server should be running on http://localhost:3000"