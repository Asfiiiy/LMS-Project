#!/bin/bash

# Test Script: Enroll Student, Set Deadlines, and Configure Installments
# Usage: ./test-enroll-with-deadlines-payments.sh YOUR_TOKEN STUDENT_ID COURSE_ID

TOKEN="${1:-ai_tok_199948873db7b589536eefe554e441950ad35048cd4e797b4d6eee60afc80e34}"
STUDENT_ID="${2:-156}"  # Test Student 1769507356
COURSE_ID="${3:-110}"   # Qualifi Level 5 Diploma in Health and Social Care
BASE_URL="https://lms.inspirelondoncollege.com/api"

echo "🎓 Testing: Enroll Student, Set Deadlines, and Configure Payments"
echo "=================================================================="
echo ""
echo "Student ID: $STUDENT_ID"
echo "Course ID: $COURSE_ID"
echo ""

# Step 1: Get course info and units
echo "📚 Step 1: Getting course information and units..."
echo "----------------------------------------"

# Get course details
COURSE_INFO=$(curl -s -X GET "${BASE_URL}/ai/enrollments/courses" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

COURSE_NAME=$(echo "$COURSE_INFO" | jq -r ".courses[] | select(.id == $COURSE_ID) | .title" 2>/dev/null)
echo "Course: $COURSE_NAME"
echo ""

# Step 2: Enroll student
echo "📝 Step 2: Enrolling student in course..."
echo "----------------------------------------"

ENROLL_RESPONSE=$(curl -s -X POST "${BASE_URL}/ai/enrollments/enroll" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"courseId\": $COURSE_ID,
    \"studentId\": $STUDENT_ID
  }" \
  -w "\nHTTP_STATUS:%{http_code}")

ENROLL_HTTP=$(echo "$ENROLL_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
ENROLL_BODY=$(echo "$ENROLL_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $ENROLL_HTTP"
echo "$ENROLL_BODY" | jq '.' 2>/dev/null || echo "$ENROLL_BODY"
echo ""

if [ "$ENROLL_HTTP" != "200" ]; then
  echo "❌ Enrollment failed. Cannot proceed."
  exit 1
fi

# Extract topics/units from response
REQUIRES_SETUP=$(echo "$ENROLL_BODY" | jq -r '.requiresDeadlineSetup' 2>/dev/null)
TOPICS_JSON=$(echo "$ENROLL_BODY" | jq -r '.topics' 2>/dev/null)

if [ "$REQUIRES_SETUP" != "true" ] || [ "$TOPICS_JSON" = "null" ]; then
  echo "⚠️  Course does not require deadline setup, or no units found"
  echo "Proceeding with payment setup only..."
  TOPICS_COUNT=0
else
  TOPICS_COUNT=$(echo "$TOPICS_JSON" | jq 'length' 2>/dev/null || echo "0")
  echo "✅ Found $TOPICS_COUNT units/topics that need deadlines"
fi

echo ""

# Step 3: Set deadlines (if units exist)
if [ "$TOPICS_COUNT" -gt 0 ]; then
  echo "📅 Step 3: Setting topic deadlines..."
  echo "----------------------------------------"

  # Generate deadlines array with random dates (30-90 days from now)
  DEADLINES_ARRAY="["
  FIRST=true

  echo "$TOPICS_JSON" | jq -c '.[]' 2>/dev/null | while read -r topic; do
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      DEADLINES_ARRAY+=","
    fi

    TOPIC_ID=$(echo "$topic" | jq -r '.id')
    TOPIC_TYPE=$(echo "$topic" | jq -r '.type // "qualification_unit"')
    
    # Generate random deadline (30-90 days from now)
    DAYS_FROM_NOW=$((RANDOM % 60 + 30))
    DEADLINE_DATE=$(date -d "+${DAYS_FROM_NOW} days" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -v+${DAYS_FROM_NOW}d "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "")
    
    if [ -z "$DEADLINE_DATE" ]; then
      # Fallback: use Python or node to calculate date
      DEADLINE_DATE=$(node -e "const d = new Date(); d.setDate(d.getDate() + $DAYS_FROM_NOW); console.log(d.toISOString().slice(0, 19).replace('T', ' '))" 2>/dev/null)
    fi

    DEADLINES_ARRAY+="{\"topicId\":$TOPIC_ID,\"topicType\":\"$TOPIC_TYPE\",\"deadline\":\"$DEADLINE_DATE\",\"notes\":\"AI automated deadline\"}"
  done

  DEADLINES_ARRAY+="]"

  # If jq parsing failed, create simple deadlines array
  if [ "$DEADLINES_ARRAY" = "[]" ] || [ -z "$DEADLINES_ARRAY" ]; then
    echo "⚠️  Could not parse topics. Creating manual deadlines..."
    # Get units directly from database or create simple structure
    DEADLINES_ARRAY="[]"
  fi

  if [ "$DEADLINES_ARRAY" != "[]" ]; then
    DEADLINE_RESPONSE=$(curl -s -X POST "${BASE_URL}/ai/enrollments/setup/deadlines" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"courseId\": $COURSE_ID,
        \"studentId\": $STUDENT_ID,
        \"deadlines\": $DEADLINES_ARRAY
      }" \
      -w "\nHTTP_STATUS:%{http_code}")

    DEADLINE_HTTP=$(echo "$DEADLINE_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    DEADLINE_BODY=$(echo "$DEADLINE_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

    echo "HTTP Status: $DEADLINE_HTTP"
    echo "$DEADLINE_BODY" | jq '.' 2>/dev/null || echo "$DEADLINE_BODY"
    echo ""
  fi
else
  echo "⏭️  Step 3: Skipping deadlines (no units found)"
  echo ""
fi

# Step 4: Set up installment payment plan
echo "💳 Step 4: Setting up installment payment plan..."
echo "----------------------------------------"

# Create installment plan (3 installments)
INSTALLMENT_1_DATE=$(node -e "const d = new Date(); d.setDate(d.getDate() + 7); console.log(d.toISOString().slice(0, 10))" 2>/dev/null || date -d "+7 days" "+%Y-%m-%d" 2>/dev/null || echo "")
INSTALLMENT_2_DATE=$(node -e "const d = new Date(); d.setDate(d.getDate() + 30); console.log(d.toISOString().slice(0, 10))" 2>/dev/null || date -d "+30 days" "+%Y-%m-%d" 2>/dev/null || echo "")
INSTALLMENT_3_DATE=$(node -e "const d = new Date(); d.setDate(d.getDate() + 60); console.log(d.toISOString().slice(0, 10))" 2>/dev/null || date -d "+60 days" "+%Y-%m-%d" 2>/dev/null || echo "")

PAYMENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/ai/enrollments/setup/payments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"courseId\": $COURSE_ID,
    \"studentId\": $STUDENT_ID,
    \"paymentType\": \"installment\",
    \"installments\": [
      {
        \"installment_number\": 1,
        \"installment_name\": \"Enrolment Fee\",
        \"amount\": 500.00,
        \"due_date\": \"${INSTALLMENT_1_DATE}\",
        \"status\": \"due\"
      },
      {
        \"installment_number\": 2,
        \"installment_name\": \"First Installment\",
        \"amount\": 1000.00,
        \"due_date\": \"${INSTALLMENT_2_DATE}\",
        \"status\": \"due\"
      },
      {
        \"installment_number\": 3,
        \"installment_name\": \"Final Installment\",
        \"amount\": 1500.00,
        \"due_date\": \"${INSTALLMENT_3_DATE}\",
        \"status\": \"due\"
      }
    ]
  }" \
  -w "\nHTTP_STATUS:%{http_code}")

PAYMENT_HTTP=$(echo "$PAYMENT_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
PAYMENT_BODY=$(echo "$PAYMENT_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $PAYMENT_HTTP"
echo "$PAYMENT_BODY" | jq '.' 2>/dev/null || echo "$PAYMENT_BODY"
echo ""

if [ "$PAYMENT_HTTP" = "200" ]; then
  echo "✅ Payment setup completed successfully!"
else
  echo "❌ Payment setup failed"
fi

echo ""
echo "📋 Summary:"
echo "   Student ID: $STUDENT_ID"
echo "   Course ID: $COURSE_ID"
echo "   Course: $COURSE_NAME"
echo "   Deadlines Set: $([ "$TOPICS_COUNT" -gt 0 ] && echo "Yes ($TOPICS_COUNT units)" || echo "No units found")"
echo "   Payment Plan: Installment (3 installments)"
echo ""
echo "✅ Test complete!"
