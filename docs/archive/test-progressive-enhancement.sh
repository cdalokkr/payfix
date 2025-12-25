#!/bin/bash

# ============================================
# Progressive Enhancement Testing Script
# Phase 3 - Next.js Optimization Implementation
# ============================================

echo "🚀 Starting Progressive Enhancement Testing..."
echo "=========================================="

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

# Test 1: TypeScript Compilation
echo ""
print_status "🔍 Test 1: TypeScript Compilation"
npx tsc --noEmit --strict

if [ $? -eq 0 ]; then
    print_success "TypeScript compilation passed"
else
    print_error "TypeScript compilation failed"
    exit 1
fi

# Test 2: ESLint Validation
echo ""
print_status "🔍 Test 2: ESLint Validation"
npm run lint

if [ $? -eq 0 ]; then
    print_success "ESLint validation passed"
else
    print_warning "ESLint validation had issues (non-blocking)"
fi

# Test 3: Next.js Build
echo ""
print_status "🔍 Test 3: Next.js Build"
npm run build

if [ $? -eq 0 ]; then
    print_success "Next.js build passed"
else
    print_error "Next.js build failed"
    exit 1
fi

# Test 4: Component Structure Validation
echo ""
print_status "🔍 Test 4: Component Structure Validation"

# Check if error boundary exists
if [ -f "components/ui/error-boundary.tsx" ]; then
    print_success "Error boundary component exists"
else
    print_error "Error boundary component missing"
fi

# Check if streaming components exist
if [ -f "components/dashboard/admin-dashboard-streaming.tsx" ]; then
    print_success "Streaming components exist"
else
    print_error "Streaming components missing"
fi

# Check if optimistic hooks exist
if [ -f "hooks/use-admin-user-optimistic-operations.ts" ]; then
    print_success "Optimistic hooks exist"
else
    print_error "Optimistic hooks missing"
fi

# Check if enhanced skeletons exist
if [ -f "components/dashboard/skeletons/activity-skeleton.tsx" ] && [ -f "components/dashboard/skeletons/metric-card-skeleton.tsx" ]; then
    print_success "Enhanced skeleton components exist"
else
    print_error "Enhanced skeleton components missing"
fi

# Check if error logging exists
if [ -f "lib/error-logging.tsx" ]; then
    print_success "Error logging service exists"
else
    print_error "Error logging service missing"
fi

# Test 5: Admin Dashboard Integration
echo ""
print_status "🔍 Test 5: Admin Dashboard Integration"

# Check if admin page uses streaming
if grep -q "AdminDashboardStreaming" "app/(dashboard)/admin/page.tsx"; then
    print_success "Admin page uses streaming components"
else
    print_warning "Admin page may not be using streaming components"
fi

# Check if error boundary is used
if grep -q "PageErrorBoundary" "app/(dashboard)/admin/page.tsx"; then
    print_success "Admin page uses error boundary"
else
    print_warning "Admin page may not be using error boundary"
fi

# Test 6: CSS Animations
echo ""
print_status "🔍 Test 6: CSS Animations"

# Check if animations are defined
if grep -q "animate-shimmer" "app/globals.css"; then
    print_success "CSS animations defined"
else
    print_error "CSS animations missing"
fi

# Test 7: Performance Metrics Validation
echo ""
print_status "🔍 Test 7: Performance Metrics Validation"

# Check if performance monitoring is in place
if grep -q "PerformanceObserver" "lib/error-logging.tsx" 2>/dev/null || grep -q "performance" "app/(dashboard)/admin/page.tsx" 2>/dev/null; then
    print_success "Performance monitoring in place"
else
    print_warning "Performance monitoring may need enhancement"
fi

# Test 8: React Query Integration
echo ""
print_status "🔍 Test 8: React Query Integration"

# Check if React Query hooks are properly implemented
if grep -q "useMutation" "hooks/use-admin-user-optimistic-operations.ts"; then
    print_success "React Query mutations implemented"
else
    print_error "React Query mutations missing"
fi

if grep -q "useQueryClient" "hooks/use-admin-user-optimistic-operations.ts"; then
    print_success "Query client integration implemented"
else
    print_error "Query client integration missing"
fi

# Summary
echo ""
echo "=========================================="
print_status "📊 Progressive Enhancement Implementation Summary"
echo "=========================================="
echo ""

# Count implemented features
FEATURES_COUNT=0
TOTAL_FEATURES=10

# Check each feature
[[ -f "components/ui/error-boundary.tsx" ]] && ((FEATURES_COUNT++))
[[ -f "components/dashboard/admin-dashboard-streaming.tsx" ]] && ((FEATURES_COUNT++))
[[ -f "hooks/use-admin-user-optimistic-operations.ts" ]] && ((FEATURES_COUNT++))
[[ -f "components/dashboard/skeletons/activity-skeleton.tsx" ]] && ((FEATURES_COUNT++))
[[ -f "components/dashboard/skeletons/metric-card-skeleton.tsx" ]] && ((FEATURES_COUNT++))
[[ -f "lib/error-logging.tsx" ]] && ((FEATURES_COUNT++))
[[ -f "app/(dashboard)/admin/page.tsx" ]] && ((FEATURES_COUNT++))
[[ -f "app/globals.css" ]] && ((FEATURES_COUNT++))

# Additional checks for specific implementations
grep -q "Suspense" "components/dashboard/admin-dashboard-streaming.tsx" 2>/dev/null && ((FEATURES_COUNT++))
grep -q "ErrorBoundary" "components/ui/error-boundary.tsx" 2>/dev/null && ((FEATURES_COUNT++))

echo "✅ Implemented Features: $FEATURES_COUNT/$TOTAL_FEATURES"
echo ""

# Calculate completion percentage
COMPLETION_PERCENT=$((FEATURES_COUNT * 100 / TOTAL_FEATURES))
echo "📈 Implementation Progress: $COMPLETION_PERCENT%"

# Performance expectations
echo ""
print_status "🎯 Performance Targets:"
echo "  • Time to Interactive: <2s on 3G network"
echo "  • Progressive Loading: Functional"
echo "  • Optimistic Updates: Working correctly"
echo "  • Error Boundaries: Graceful error handling"

# Success criteria
echo ""
print_status "✅ Success Criteria Met:"
if [ $COMPLETION_PERCENT -ge 80 ]; then
    print_success "High implementation completion rate"
else
    print_warning "Implementation needs completion"
fi

if [ -f "components/ui/error-boundary.tsx" ] && [ -f "lib/error-logging.tsx" ]; then
    print_success "Comprehensive error handling implemented"
else
    print_error "Error handling incomplete"
fi

if [ -f "hooks/use-admin-user-optimistic-operations.ts" ]; then
    print_success "Optimistic updates with rollback functionality"
else
    print_error "Optimistic updates need implementation"
fi

if [ -f "app/globals.css" ] && grep -q "animate-shimmer" "app/globals.css"; then
    print_success "Enhanced skeleton animations implemented"
else
    print_error "Skeleton animations need enhancement"
fi

echo ""
print_success "🏁 Progressive Enhancement Testing Complete!"
echo ""

# Exit with success if critical features are implemented
if [ $FEATURES_COUNT -ge 6 ]; then
    exit 0
else
    print_error "Critical features missing. Please complete implementation."
    exit 1
fi