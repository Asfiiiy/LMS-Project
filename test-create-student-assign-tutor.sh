#!/bin/bash

# Test Script: Create Student and Assign Tutor
# Usage: ./test-create-student-assign-tutor.sh YOUR_TOKEN

TOKEN="${1:-ai_tok_199948873db7b589536eefe554e441950ad35048cd4e797b4d6eee60afc80e34}"
BASE_URL="https://lms.inspirelondoncollege.com/api"

echo "🧪 Testing: Create Student and Assign Tutor"
echo "=========================================="
echo ""

# Step 1: Create a Student
echo "📝 Step 1: Creating a new student..."
echo "----------------------------------------"

# Generate a unique email to avoid conflicts
TIMESTAMP=$(date +%s)
STUDENT_EMAIL="teststudent_${TIMESTAMP}@example.com"
STUDENT_NAME="Test Student ${TIMESTAMP}"

RESPONSE=$(curl -X POST "${BASE_URL}/ai/users/create" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${STUDENT_NAME}\",
    \"email\": \"${STUDENT_EMAIL}\",
    \"password\": \"TestPass123!\",
    \"role_id\": 4
  }" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -s)

HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Extract student ID from response
STUDENT_ID=$(echo "$BODY" | jq -r '.userId // .user.id // empty' 2>/dev/null)

if [ -z "$STUDENT_ID" ] || [ "$STUDENT_ID" = "null" ]; then
  echo "❌ Failed to create student. Cannot proceed with tutor assignment."
  exit 1
fi

echo "✅ Student created successfully!"
echo "   Student ID: $STUDENT_ID"
echo "   Student Name: $STUDENT_NAME"
echo "   Student Email: $STUDENT_EMAIL"
echo ""

# Step 2: Get a tutor ID (we need to find an existing tutor)
echo "👨‍🏫 Step 2: Finding a tutor to assign..."
echo "----------------------------------------"

# Note: You need to provide a tutor_id. Let's try to get tutors from the system
# For now, we'll ask user to provide tutor_id, or we can try a common one
TUTOR_ID="${2:-2}"  # Default to tutor ID 2, or provide as second argument

echo "Using Tutor ID: $TUTOR_ID"
echo ""

# Step 3: Assign Tutor to Student
echo "🔗 Step 3: Assigning tutor to student..."
echo "----------------------------------------"

ASSIGN_RESPONSE=$(curl -X POST "${BASE_URL}/ai/users/assign-tutor" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"student_id\": ${STUDENT_ID},
    \"tutor_id\": ${TUTOR_ID}
  }" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -s)

ASSIGN_HTTP_STATUS=$(echo "$ASSIGN_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
ASSIGN_BODY=$(echo "$ASSIGN_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $ASSIGN_HTTP_STATUS"
echo "Response:"
echo "$ASSIGN_BODY" | jq '.' 2>/dev/null || echo "$ASSIGN_BODY"
echo ""

if [ "$ASSIGN_HTTP_STATUS" = "200" ]; then
  echo "✅ Tutor assigned successfully!"
  echo ""
  echo "📋 Summary:"
  echo "   Student ID: $STUDENT_ID"
  echo "   Student Name: $STUDENT_NAME"
  echo "   Student Email: $STUDENT_EMAIL"
  echo "   Assigned Tutor ID: $TUTOR_ID"
else
  echo "❌ Failed to assign tutor"
fi

echo ""
echo "✅ Test complete!"
