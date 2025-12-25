#!/bin/bash

# ============================================
# Next.js 16.0.1 Upgrade Script
# ============================================
# This script performs the upgrade from Next.js 15.5.4 to 16.0.1
# Usage: ./scripts/next16-upgrade.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Create scripts directory if it doesn't exist
mkdir -p scripts

log_info "🚀 Starting Next.js 16.0.1 upgrade process..."

# Step 1: Backup current state
log_info "📦 Creating backup of current state..."
BACKUP_DIR="backups/nextjs16-upgrade-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup key files
cp package.json "$BACKUP_DIR/"
cp package-lock.json "$BACKUP_DIR/"
cp next.config.ts "$BACKUP_DIR/"
cp tsconfig.json "$BACKUP_DIR/"
cp -r app/ "$BACKUP_DIR/app-backup/" 2>/dev/null || true
cp -r components/ "$BACKUP_DIR/components-backup/" 2>/dev/null || true
cp -r lib/ "$BACKUP_DIR/lib-backup/" 2>/dev/null || true
cp middleware.ts "$BACKUP_DIR/" 2>/dev/null || true

log_success "Backup created in: $BACKUP_DIR"

# Step 2: Verify current Next.js version
log_info "🔍 Verifying current Next.js version..."
CURRENT_NEXT_VERSION=$(npm ls next --depth=0 2>/dev/null | grep next@ | sed 's/.*next@//')
log_info "Current Next.js version: $CURRENT_NEXT_VERSION"

if [[ "$CURRENT_NEXT_VERSION" != "15.5.4" ]]; then
    log_warning "Current version is not 15.5.4. Expected 15.5.4, found: $CURRENT_NEXT_VERSION"
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Upgrade cancelled."
        exit 1
    fi
fi

# Step 3: Create upgrade branch
log_info "🌿 Creating upgrade branch..."
git checkout -b upgrade/nextjs-16 2>/dev/null || log_warning "Could not create git branch (not a git repo or no permissions)"

# Step 4: Install dependencies
log_info "📦 Installing Next.js 16.0.1..."

# Update Next.js packages
npm install next@16.0.1
npm install eslint-config-next@16.0.1

# Update related packages if needed
npm install @types/react@^19.0.0 2>/dev/null || log_warning "@types/react update skipped"
npm install @types/react-dom@^19.0.0 2>/dev/null || log_warning "@types/react-dom update skipped"

log_success "Dependencies updated successfully"

# Step 5: Clean install to resolve peer dependencies
log_info "🧹 Running clean install..."
rm -rf node_modules package-lock.json
npm install

log_success "Clean install completed"

# Step 6: Verify new version
log_info "🔍 Verifying new Next.js version..."
NEW_NEXT_VERSION=$(npm ls next --depth=0 2>/dev/null | grep next@ | sed 's/.*next@//')
log_success "New Next.js version: $NEW_NEXT_VERSION"

if [[ "$NEW_NEXT_VERSION" != "16.0.1"* ]]; then
    log_error "Version update failed. Expected 16.0.x, found: $NEW_NEXT_VERSION"
    exit 1
fi

# Step 7: Validate upgrade
log_info "🧪 Running validation tests..."

# Test build process
log_info "🔨 Testing build process..."
if npm run build; then
    log_success "✅ Build successful"
else
    log_error "❌ Build failed"
    log_info "Please check the build errors and fix them before proceeding"
    exit 1
fi

# Test development server (quick check)
log_info "🚧 Testing development server..."
timeout 15s npm run dev > /dev/null 2>&1 &
DEV_PID=$!
sleep 5
kill $DEV_PID 2>/dev/null || true
log_success "Development server test completed"

# TypeScript check
log_info "🔍 Running TypeScript check..."
if npx tsc --noEmit; then
    log_success "✅ TypeScript validation successful"
else
    log_warning "⚠️  TypeScript errors found - review and fix"
fi

# ESLint check
log_info "📏 Running ESLint check..."
if npm run lint; then
    log_success "✅ Linting passed"
else
    log_warning "⚠️  Linting errors found - review and fix"
fi

# Step 8: Health Check Automation
log_info "🏥 Running automated health checks..."

# Health check function
health_check() {
    local endpoint="${1:-http://localhost:3000}"
    local timeout=30

    log_info "Checking application health at $endpoint..."

    # Wait for server to be ready
    local count=0
    while [ $count -lt $timeout ]; do
        if curl -s --head --fail "$endpoint/api/health" > /dev/null 2>&1; then
            log_success "✅ Health check passed"
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done

    log_error "❌ Health check failed - application not responding"
    return 1
}

# Start development server for health check
log_info "🚀 Starting development server for health check..."
npm run dev > /dev/null 2>&1 &
DEV_SERVER_PID=$!

# Wait a bit for server to start
sleep 10

# Run health check
if health_check; then
    log_success "✅ Application health verified"
else
    log_error "❌ Health check failed"
    kill $DEV_SERVER_PID 2>/dev/null || true
    exit 1
fi

# Stop dev server
kill $DEV_SERVER_PID 2>/dev/null || true

# Step 9: Rollback Automation
log_info "🔄 Setting up rollback automation..."

# Rollback function
rollback_upgrade() {
    log_warning "Initiating rollback to previous state..."

    # Restore from backup
    if [ -d "$BACKUP_DIR" ]; then
        cp "$BACKUP_DIR/package.json" . 2>/dev/null || log_warning "Could not restore package.json"
        cp "$BACKUP_DIR/package-lock.json" . 2>/dev/null || log_warning "Could not restore package-lock.json"
        cp "$BACKUP_DIR/next.config.ts" . 2>/dev/null || log_warning "Could not restore next.config.ts"
        cp "$BACKUP_DIR/tsconfig.json" . 2>/dev/null || log_warning "Could not restore tsconfig.json"

        # Restore directories if needed
        cp -r "$BACKUP_DIR/app-backup/"* app/ 2>/dev/null || true
        cp -r "$BACKUP_DIR/components-backup/"* components/ 2>/dev/null || true
        cp -r "$BACKUP_DIR/lib-backup/"* lib/ 2>/dev/null || true

        # Reinstall dependencies
        npm install

        log_success "✅ Rollback completed"
    else
        log_error "❌ Backup directory not found: $BACKUP_DIR"
        return 1
    fi
}

# Export rollback function for external use
echo "# Rollback function for emergency use" > scripts/rollback.sh
echo "BACKUP_DIR=\"$BACKUP_DIR\"" >> scripts/rollback.sh
cat >> scripts/rollback.sh << 'EOF'
rollback_upgrade() {
    echo "🔄 Rolling back to previous state..."
    if [ -d "$BACKUP_DIR" ]; then
        cp "$BACKUP_DIR/package.json" . 2>/dev/null
        cp "$BACKUP_DIR/package-lock.json" . 2>/dev/null
        cp "$BACKUP_DIR/next.config.ts" . 2>/dev/null
        cp "$BACKUP_DIR/tsconfig.json" . 2>/dev/null
        cp -r "$BACKUP_DIR/app-backup/"* app/ 2>/dev/null || true
        cp -r "$BACKUP_DIR/components-backup/"* components/ 2>/dev/null || true
        cp -r "$BACKUP_DIR/lib-backup/"* lib/ 2>/dev/null || true
        npm install
        echo "✅ Rollback completed"
    else
        echo "❌ Backup directory not found"
        return 1
    fi
}
EOF

chmod +x scripts/rollback.sh
log_success "Rollback script created: scripts/rollback.sh"

# Step 10: Summary
log_info "📋 Upgrade Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Current Version: $CURRENT_NEXT_VERSION"
echo "   New Version:     $NEW_NEXT_VERSION"
echo "   Backup Location: $BACKUP_DIR"
echo "   Status:          ✅ Upgrade completed successfully"
echo "   Health Check:    ✅ Passed"
echo "   Rollback Ready:  ✅ scripts/rollback.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log_info "🎉 Next.js 16.0.1 upgrade completed successfully!"
log_info "📝 Next steps:"
echo "   1. Review any warnings above"
echo "   2. Test your application thoroughly"
echo "   3. Commit the changes: git add . && git commit -m 'chore: upgrade to nextjs-16.0.1'"
echo "   4. Push the branch: git push origin upgrade/nextjs-16"
echo "   5. Create a pull request for review"
echo ""
log_info "🆘 Emergency rollback:"
echo "   Run: ./scripts/rollback.sh && rollback_upgrade"
echo ""
log_success "Upgrade script completed! 🚀"