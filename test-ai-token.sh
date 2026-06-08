#!/bin/bash

# Test AI Token Script
# Usage: ./test-ai-token.sh YOUR_TOKEN

TOKEN="${1:-ai_tok_199948873db7b589536eefe554e441950ad35048cd4e797b4d6eee60afc80e34}"
BASE_URL="https://lms.inspirelondoncollege.com/api"

echo "🧪 Testing AI Token: ${TOKEN:0:20}..."
echo ""

# Test 1: Get Courses (read permission)
echo "📚 Test 1: Getting courses list..."
echo "----------------------------------------"
curl -X GET "${BASE_URL}/ai/enrollments/courses" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || curl -X GET "${BASE_URL}/ai/enrollments/courses" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo ""

# Test 2: Get Students (read permission)
echo "👥 Test 2: Getting students list..."
echo "----------------------------------------"
curl -X GET "${BASE_URL}/ai/enrollments/students" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || curl -X GET "${BASE_URL}/ai/enrollments/students" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo ""

# Test 3: Test without token (should fail)
echo "❌ Test 3: Testing without token (should fail)..."
echo "----------------------------------------"
curl -X GET "${BASE_URL}/ai/enrollments/courses" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || curl -X GET "${BASE_URL}/ai/enrollments/courses" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo ""
echo "✅ Testing complete!"
echo ""
echo "Expected results:"
echo "- Test 1 & 2: Should return 200 with data (if token has enrollments.read permission)"
echo "- Test 3: Should return 401 (Unauthorized)"
