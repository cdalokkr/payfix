#!/bin/bash

# Security Testing Script for Phase 1 Optimizations
# Tests security headers, CSP policies, and validation

echo "=== Phase 1 Security Testing ==="
echo "Date: $(date -u '+%Y-%m-%dT%H:%M:%S.%3NZ')"
echo ""

# Test 1: Security Headers Validation
echo "1. Testing Security Headers..."
echo "   Target: http://localhost:3000"
echo ""

# Test HTTP headers for homepage
echo "Homepage Headers:"
curl -I http://localhost:3000 2>/dev/null | grep -E '(Strict-Transport-Security|Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|X-XSS-Protection|Referrer-Policy|Permissions-Policy)' || echo "   ❌ No security headers found"

echo ""
echo "Admin Page Headers:"
curl -I http://localhost:3000/admin 2>/dev/null | grep -E '(Strict-Transport-Security|Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|X-XSS-Protection|Referrer-Policy|Permissions-Policy)' || echo "   ❌ No security headers found"

echo ""
echo "Login Page Headers:"
curl -I http://localhost:3000/login 2>/dev/null | grep -E '(Strict-Transport-Security|Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|X-XSS-Protection|Referrer-Policy|Permissions-Policy)' || echo "   ❌ No security headers found"

echo ""

# Test 2: CSP Policy Validation
echo "2. Testing Content Security Policy..."
echo ""

# Check if CSP headers are present
CSP_CHECK=$(curl -s -I http://localhost:3000 | grep -i "content-security-policy")
if [ ! -z "$CSP_CHECK" ]; then
    echo "   ✅ CSP Header found:"
    echo "   $CSP_CHECK"
    
    # Check for Supabase connectivity
    if echo "$CSP_CHECK" | grep -q "supabase.co"; then
        echo "   ✅ Supabase connectivity allowed in CSP"
    else
        echo "   ❌ Supabase connectivity not found in CSP"
    fi
    
    # Check for WebSocket connectivity
    if echo "$CSP_CHECK" | grep -q "wss://"; then
        echo "   ✅ WebSocket connectivity allowed in CSP"
    else
        echo "   ❌ WebSocket connectivity not found in CSP"
    fi
else
    echo "   ❌ CSP header not found"
fi

echo ""

# Test 3: HSTS Validation
echo "3. Testing HTTP Strict Transport Security..."
echo ""

HSTS_CHECK=$(curl -s -I http://localhost:3000 | grep -i "strict-transport-security")
if [ ! -z "$HSTS_CHECK" ]; then
    echo "   ✅ HSTS Header found:"
    echo "   $HSTS_CHECK"
    
    # Check for preload directive
    if echo "$HSTS_CHECK" | grep -q "preload"; then
        echo "   ✅ HSTS preload directive found"
    else
        echo "   ⚠️  HSTS preload directive not found"
    fi
else
    echo "   ❌ HSTS header not found"
fi

echo ""

# Test 4: XSS Protection
echo "4. Testing XSS Protection..."
echo ""

XSS_CHECK=$(curl -s -I http://localhost:3000 | grep -i "x-xss-protection")
if [ ! -z "$XSS_CHECK" ]; then
    echo "   ✅ XSS Protection header found:"
    echo "   $XSS_CHECK"
else
    echo "   ❌ XSS Protection header not found"
fi

echo ""

# Test 5: Frame Protection
echo "5. Testing Frame Protection..."
echo ""

FRAME_CHECK=$(curl -s -I http://localhost:3000 | grep -i "x-frame-options")
if [ ! -z "$FRAME_CHECK" ]; then
    echo "   ✅ Frame Protection header found:"
    echo "   $FRAME_CHECK"
else
    echo "   ❌ Frame Protection header not found"
fi

echo ""

# Test 6: Content Type Protection
echo "6. Testing Content Type Protection..."
echo ""

TYPE_CHECK=$(curl -s -I http://localhost:3000 | grep -i "x-content-type-options")
if [ ! -z "$TYPE_CHECK" ]; then
    echo "   ✅ Content Type Protection header found:"
    echo "   $TYPE_CHECK"
else
    echo "   ❌ Content Type Protection header not found"
fi

echo ""
echo "=== Security Testing Complete ==="