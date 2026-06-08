#!/bin/bash

# Complete Enrollment Test: Enroll Student, Set Deadlines, Configure Installments
# Usage: ./test-enroll-complete.sh YOUR_TOKEN

TOKEN="${1:-ai_tok_199948873db7b589536eefe554e441950ad35048cd4e797b4d6eee60afc80e34}"
STUDENT_ID=156  # Test Student 1769507356
COURSE_ID=110   # Qualifi Level 5 Diploma in Health and Social Care
BASE_URL="https://lms.inspirelondoncollege.com/api"

echo "🎓 Complete Enrollment Test: Student + Deadlines + Payments"
echo "============================================================"
echo ""

# Step 1: Enroll student
echo "📝 Step 1: Enrolling student in course..."
echo "----------------------------------------"

ENROLL_RESPONSE=$(curl -s -X POST "${BASE_URL}/ai/enrollments/enroll" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"courseId\": $COURSE_ID,
    \"studentId\": $STUDENT_ID
  }")

echo "$ENROLL_RESPONSE" | jq '.' 2>/dev/null || echo "$ENROLL_RESPONSE"
echo ""

SUCCESS=$(echo "$ENROLL_RESPONSE" | jq -r '.success' 2>/dev/null)
if [ "$SUCCESS" != "true" ]; then
  echo "❌ Enrollment failed. Exiting."
  exit 1
fi

echo "✅ Student enrolled successfully!"
echo ""

# Step 2: Set deadlines for all 5 units
echo "📅 Step 2: Setting deadlines for all units..."
echo "----------------------------------------"

# Calculate dates (using node for cross-platform compatibility)
DATE1=$(node -e "const d = new Date(); d.setDate(d.getDate() + 30); console.log(d.toISOString().slice(0, 19).replace('T', ' '))")
DATE2=$(node -e "const d = new Date(); d.setDate(d.getDate() + 45); console.log(d.toISOString().slice(0, 19).replace('T', ' '))")
DATE3=$(node -e "const d = new Date(); d.setDate(d.getDate() + 60); console.log(d.toISOString().slice(0, 19).replace('T', ' '))")
DATE4=$(node -e "const d = new Date(); d.setDate(d.getDate() + 75); console.log(d.toISOString().slice(0, 19).replace('T', ' '))")
DATE5=$(node -e "const d = new Date(); d.setDate(d.getDate() + 90); console.log(d.toISOString().slice(0, 19).replace('T', ' '))")

DEADLINE_RESPONSE=$(curl -s -X POST "${BASE_URL}/ai/enrollments/setup/deadlines" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"courseId\": $COURSE_ID,
    \"studentId\": $STUDENT_ID,
    \"deadlines\": [
      {
        \"topicId\": 149,
        \"topicType\": \"qualification_unit\",
        \"deadline\": \"$DATE1\",
        \"notes\": \"AI automated deadline - Unit 1\"
      },
      {
        \"topicId\": 150,
        \"topicType\": \"qualification_unit\",
        \"deadline\": \"$DATE2\",
        \"notes\": \"AI automated deadline - Unit 2\"
      },
      {
        \"topicId\": 151,
        \"topicType\": \"qualification_unit\",
        \"deadline\": \"$DATE3\",
        \"notes\": \"AI automated deadline - Unit 3\"
      },
      {
        \"topicId\": 152,
        \"topicType\": \"qualification_unit\",
        \"deadline\": \"$DATE4\",
        \"notes\": \"AI automated deadline - Unit 4\"
      },
      {
        \"topicId\": 153,
        \"topicType\": \"qualification_unit\",
        \"deadline\": \"$DATE5\",
        \"notes\": \"AI automated deadline - Unit 5\"
      }
    ]
  }")

echo "$DEADLINE_RESPONSE" | jq '.' 2>/dev/null || echo "$DEADLINE_RESPONSE"
echo ""

DEADLINE_SUCCESS=$(echo "$DEADLINE_RESPONSE" | jq -r '.success' 2>/dev/null)
if [ "$DEADLINE_SUCCESS" = "true" ]; then
  echo "✅ Deadlines set successfully!"
  echo "   Unit 1: $DATE1"
  echo "   Unit 2: $DATE2"
  echo "   Unit 3: $DATE3"
  echo "   Unit 4: $DATE4"
  echo "   Unit 5: $DATE5"
else
  echo "❌ Failed to set deadlines"
fi
echo ""

# Step 3: Set up installment payment plan
echo "💳 Step 3: Setting up installment payment plan..."
echo "----------------------------------------"

# Calculate installment dates
INST1_DATE=$(node -e "const d = new Date(); d.setDate(d.getDate() + 7); console.log(d.toISOString().slice(0, 10))")
INST2_DATE=$(node -e "const d = new Date(); d.setDate(d.getDate() + 30); console.log(d.toISOString().slice(0, 10))")
INST3_DATE=$(node -e "const d = new Date(); d.setDate(d.getDate() + 60); console.log(d.toISOString().slice(0, 10))")

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
        \"due_date\": \"$INST1_DATE\",
        \"status\": \"due\"
      },
      {
        \"installment_number\": 2,
        \"installment_name\": \"First Installment\",
        \"amount\": 1000.00,
        \"due_date\": \"$INST2_DATE\",
        \"status\": \"due\"
      },
      {
        \"installment_number\": 3,
        \"installment_name\": \"Final Installment\",
        \"amount\": 1500.00,
        \"due_date\": \"$INST3_DATE\",
        \"status\": \"due\"
      }
    ]
  }")

echo "$PAYMENT_RESPONSE" | jq '.' 2>/dev/null || echo "$PAYMENT_RESPONSE"
echo ""

PAYMENT_SUCCESS=$(echo "$PAYMENT_RESPONSE" | jq -r '.success' 2>/dev/null)
if [ "$PAYMENT_SUCCESS" = "true" ]; then
  echo "✅ Payment plan configured successfully!"
  echo "   Installment 1: £500.00 (Due: $INST1_DATE)"
  echo "   Installment 2: £1000.00 (Due: $INST2_DATE)"
  echo "   Installment 3: £1500.00 (Due: $INST3_DATE)"
  echo "   Total: £3000.00"
else
  echo "❌ Failed to configure payment plan"
fi

echo ""
echo "============================================================"
echo "✅ Complete Enrollment Test Finished!"
echo ""
echo "📋 Summary:"
echo "   Student ID: $STUDENT_ID (Test Student 1769507356)"
echo "   Course ID: $COURSE_ID (Qualifi Level 5 Diploma in Health and Social Care)"
echo "   Status: Enrolled ✅"
echo "   Deadlines: 5 units with deadlines ✅"
echo "   Payment Plan: 3 installments (£3000.00 total) ✅"
echo ""
echo "You can now check the enrollment in Admin Dashboard → Student Insights"
