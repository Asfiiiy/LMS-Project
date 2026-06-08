#!/bin/bash

# ============================================================
# COMPLETE ENROLLMENT API TEST - All 3 Steps
# ============================================================
# 
# This script contains all 3 API calls needed for complete enrollment:
# 1. Enroll student in course
# 2. Set deadlines for all units/topics
# 3. Configure payment installments
#
# Usage: Copy and paste each curl command, or run this script
# ============================================================

TOKEN="ai_tok_199948873db7b589536eefe554e441950ad35048cd4e797b4d6eee60afc80e34"
STUDENT_ID=156
COURSE_ID=110
BASE_URL="https://lms.inspirelondoncollege.com/api"

echo "============================================================"
echo "COMPLETE ENROLLMENT API TEST - All 3 Steps"
echo "============================================================"
echo ""

# ============================================================
# STEP 1: ENROLL STUDENT IN COURSE
# ============================================================
echo "📝 STEP 1: Enroll Student in Course"
echo "----------------------------------------"
echo ""
echo "curl -X POST \"${BASE_URL}/ai/enrollments/enroll\" \\"
echo "  -H \"Authorization: Bearer ${TOKEN}\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"courseId\": ${COURSE_ID},"
echo "    \"studentId\": ${STUDENT_ID}"
echo "  }'"
echo ""
echo "---"
echo ""

curl -X POST "${BASE_URL}/ai/enrollments/enroll" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"courseId\": ${COURSE_ID},
    \"studentId\": ${STUDENT_ID}
  }"

echo ""
echo ""
echo "============================================================"
echo ""

# ============================================================
# STEP 2: SET DEADLINES FOR ALL UNITS
# ============================================================
echo "📅 STEP 2: Set Deadlines for All Units"
echo "----------------------------------------"
echo ""
echo "curl -X POST \"${BASE_URL}/ai/enrollments/setup/deadlines\" \\"
echo "  -H \"Authorization: Bearer ${TOKEN}\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"courseId\": ${COURSE_ID},"
echo "    \"studentId\": ${STUDENT_ID},"
echo "    \"deadlines\": ["
echo "      {"
echo "        \"topicId\": 149,"
echo "        \"topicType\": \"qualification_unit\","
echo "        \"deadline\": \"2026-02-26 12:00:00\","
echo "        \"notes\": \"Unit 1 deadline\""
echo "      },"
echo "      {"
echo "        \"topicId\": 150,"
echo "        \"topicType\": \"qualification_unit\","
echo "        \"deadline\": \"2026-03-13 12:00:00\","
echo "        \"notes\": \"Unit 2 deadline\""
echo "      },"
echo "      {"
echo "        \"topicId\": 151,"
echo "        \"topicType\": \"qualification_unit\","
echo "        \"deadline\": \"2026-03-28 12:00:00\","
echo "        \"notes\": \"Unit 3 deadline\""
echo "      },"
echo "      {"
echo "        \"topicId\": 152,"
echo "        \"topicType\": \"qualification_unit\","
echo "        \"deadline\": \"2026-04-12 12:00:00\","
echo "        \"notes\": \"Unit 4 deadline\""
echo "      },"
echo "      {"
echo "        \"topicId\": 153,"
echo "        \"topicType\": \"qualification_unit\","
echo "        \"deadline\": \"2026-04-27 12:00:00\","
echo "        \"notes\": \"Unit 5 deadline\""
echo "      }"
echo "    ]"
echo "  }'"
echo ""
echo "---"
echo ""

curl -X POST "${BASE_URL}/ai/enrollments/setup/deadlines" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"courseId\": ${COURSE_ID},
    \"studentId\": ${STUDENT_ID},
    \"deadlines\": [
      {
        \"topicId\": 149,
        \"topicType\": \"qualification_unit\",
        \"deadline\": \"2026-02-26 12:00:00\",
        \"notes\": \"Unit 1 deadline\"
      },
      {
        \"topicId\": 150,
        \"topicType\": \"qualification_unit\",
        \"deadline\": \"2026-03-13 12:00:00\",
        \"notes\": \"Unit 2 deadline\"
      },
      {
        \"topicId\": 151,
        \"topicType\": \"qualification_unit\",
        \"deadline\": \"2026-03-28 12:00:00\",
        \"notes\": \"Unit 3 deadline\"
      },
      {
        \"topicId\": 152,
        \"topicType\": \"qualification_unit\",
        \"deadline\": \"2026-04-12 12:00:00\",
        \"notes\": \"Unit 4 deadline\"
      },
      {
        \"topicId\": 153,
        \"topicType\": \"qualification_unit\",
        \"deadline\": \"2026-04-27 12:00:00\",
        \"notes\": \"Unit 5 deadline\"
      }
    ]
  }"

echo ""
echo ""
echo "============================================================"
echo ""

# ============================================================
# STEP 3: CONFIGURE PAYMENT INSTALLMENTS
# ============================================================
echo "💳 STEP 3: Configure Payment Installments"
echo "----------------------------------------"
echo ""
echo "curl -X POST \"${BASE_URL}/ai/enrollments/setup/payments\" \\"
echo "  -H \"Authorization: Bearer ${TOKEN}\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"courseId\": ${COURSE_ID},"
echo "    \"studentId\": ${STUDENT_ID},"
echo "    \"paymentType\": \"installment\","
echo "    \"installments\": ["
echo "      {"
echo "        \"installment_number\": 1,"
echo "        \"installment_name\": \"Enrolment Fee\","
echo "        \"amount\": 500.00,"
echo "        \"due_date\": \"2026-02-03\","
echo "        \"status\": \"due\""
echo "      },"
echo "      {"
echo "        \"installment_number\": 2,"
echo "        \"installment_name\": \"First Installment\","
echo "        \"amount\": 1000.00,"
echo "        \"due_date\": \"2026-02-26\","
echo "        \"status\": \"due\""
echo "      },"
echo "      {"
echo "        \"installment_number\": 3,"
echo "        \"installment_name\": \"Final Installment\","
echo "        \"amount\": 1500.00,"
echo "        \"due_date\": \"2026-03-28\","
echo "        \"status\": \"due\""
echo "      }"
echo "    ]"
echo "  }'"
echo ""
echo "---"
echo ""

curl -X POST "${BASE_URL}/ai/enrollments/setup/payments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"courseId\": ${COURSE_ID},
    \"studentId\": ${STUDENT_ID},
    \"paymentType\": \"installment\",
    \"installments\": [
      {
        \"installment_number\": 1,
        \"installment_name\": \"Enrolment Fee\",
        \"amount\": 500.00,
        \"due_date\": \"2026-02-03\",
        \"status\": \"due\"
      },
      {
        \"installment_number\": 2,
        \"installment_name\": \"First Installment\",
        \"amount\": 1000.00,
        \"due_date\": \"2026-02-26\",
        \"status\": \"due\"
      },
      {
        \"installment_number\": 3,
        \"installment_name\": \"Final Installment\",
        \"amount\": 1500.00,
        \"due_date\": \"2026-03-28\",
        \"status\": \"due\"
      }
    ]
  }"

echo ""
echo ""
echo "============================================================"
echo "✅ Complete Enrollment Test Finished!"
echo "============================================================"
