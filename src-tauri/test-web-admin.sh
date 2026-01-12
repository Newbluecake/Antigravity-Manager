#!/bin/bash

# Web Admin API Test Script
# Tests the core functionality of the Web Admin API

set -e

BASE_URL="http://127.0.0.1:8046"
API_URL="$BASE_URL/api/v1"
TOKEN=""

echo "🧪 Web Admin API Test Suite"
echo "============================"
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ] && [ "$body" = "OK" ]; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed (HTTP $http_code)"
    exit 1
fi
echo ""

# Test 2: Login
echo "Test 2: Login"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"password":"admin"}')
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    TOKEN=$(echo "$body" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    if [ -n "$TOKEN" ]; then
        echo "✅ Login successful"
        echo "   Token: ${TOKEN:0:20}..."
    else
        echo "❌ Login failed: No token in response"
        exit 1
    fi
else
    echo "❌ Login failed (HTTP $http_code)"
    echo "   Response: $body"
    exit 1
fi
echo ""

# Test 3: Dashboard Stats (Protected)
echo "Test 3: Dashboard Stats"
response=$(curl -s -w "\n%{http_code}" "$API_URL/dashboard/stats" \
    -H "Authorization: Bearer $TOKEN")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    echo "✅ Dashboard stats retrieved"
    echo "   Response: $body"
else
    echo "❌ Dashboard stats failed (HTTP $http_code)"
    echo "   Response: $body"
    exit 1
fi
echo ""

# Test 4: Accounts List (Protected)
echo "Test 4: Accounts List"
response=$(curl -s -w "\n%{http_code}" "$API_URL/accounts" \
    -H "Authorization: Bearer $TOKEN")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    echo "✅ Accounts list retrieved"
    echo "   Response: $body"
else
    echo "❌ Accounts list failed (HTTP $http_code)"
    echo "   Response: $body"
    exit 1
fi
echo ""

# Test 5: Log Files List (Protected)
echo "Test 5: Log Files List"
response=$(curl -s -w "\n%{http_code}" "$API_URL/system/logs/files" \
    -H "Authorization: Bearer $TOKEN")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    echo "✅ Log files list retrieved"
    echo "   Response: $body"
else
    echo "❌ Log files list failed (HTTP $http_code)"
    echo "   Response: $body"
    exit 1
fi
echo ""

# Test 6: Static Assets
echo "Test 6: Static Assets"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/admin")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "200" ]; then
    echo "✅ Admin page served"
else
    echo "❌ Admin page failed (HTTP $http_code)"
    exit 1
fi
echo ""

# Test 7: Unauthorized Access
echo "Test 7: Unauthorized Access (should fail)"
response=$(curl -s -w "\n%{http_code}" "$API_URL/dashboard/stats")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "401" ]; then
    echo "✅ Unauthorized access correctly blocked"
else
    echo "❌ Unauthorized access not blocked (HTTP $http_code)"
    exit 1
fi
echo ""

echo "============================"
echo "✅ All tests passed!"
echo ""
