# 📋 Current System Analysis for Ticket & Chat Upgrade

**Purpose:** Document what exists NOW before building the new Department-Based Ticket & Chat Support System.  
**Key Rule:** Do NOT disturb existing dashboards. Create NEW dashboards for the ticket system.

---

## 1️⃣ CURRENT CHAT SYSTEM (What We Have)

### Database Tables (EXISTING - Do NOT Modify Structure)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| **conversations** | Direct/group/course chats | student_id, tutor_id, admin_id, course_id, conversation_type |
| **messages** | Chat messages | conversation_id, sender_id, message, file_url, message_type |
| **message_read_receipts** | Read receipts (optional) | message_id, user_id |

**conversations** structure:
- student_id, tutor_id, admin_id, course_id (participant links)
- conversation_type: 'direct' | 'group' | 'course'
- last_message_at

**messages** structure:
- conversation_id, sender_id
- message, file_url, file_name, file_type (Cloudinary)
- message_type: text, file, image, pdf, video
- is_read, read_at, parent_message_id (reply-to)
- is_edited, edited_at

**Current Data:** 102 conversations, 438 messages

---

### Chat API Endpoints (EXISTING)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/chat/start | Create or get conversation |
| GET | /api/chat/conversations/:userId | List user conversations |
| GET | /api/chat/conversations/:userId/unread-count | Unread count |
| GET | /api/chat/:conversationId | Get messages |
| POST | /api/chat/message | Send message |
| PUT | /api/chat/message/edit | Edit message |
| DELETE | /api/chat/message/delete | Delete message |
| POST | /api/chat/upload | Upload file (Cloudinary) |
| POST | /api/chat/mark-read | Mark as read |

---

### Frontend Components (EXISTING - Keep Working)

| Component | Purpose |
|-----------|---------|
| **FloatingChatProvider** | Context for floating chat windows |
| **FloatingChatWindow** | Minimizable chat box (WhatsApp-style) |
| **ChatBox** | Full chat UI (messages, send, file upload) |
| **MessageDropdown** | Navbar message icon → list conversations |
| **/chat** page | Full chat interface (sidebar + ChatBox) |

**Flow:**
- Student/Tutor/Admin → Navbar message icon → MessageDropdown → openFloatingChat()
- Or navigate to /chat for full chat page
- Student dashboard has "Chat with Tutor" button → starts conversation → redirects to /chat

---

### Where Chat is Used (EXISTING Dashboards - Do NOT Modify)

| Dashboard | Chat Access |
|-----------|-------------|
| Admin | Tab "Chat" → redirects to /chat |
| Tutor | Tab "Chat" → redirects to /chat |
| Student | "Chat with Tutor" button → /chat |
| Navbar | Message icon → MessageDropdown (all roles) |

---

### Current Chat Model (Direct Messaging)

- **Student ↔ Tutor** (student_id + tutor_id)
- **Student ↔ Admin** (student_id + admin_id)
- **Course-based** (course_id, conversation_type='course')
- **No departments, no tickets, no categories, no auto-routing**
- **No claim, no escalation, no status tracking**

---

## 2️⃣ USERS & ROLES (Current State)

### users table
- id, name, email, password_hash
- role_id (FK → roles)
- manager_id, parent_tutor_id, assigned_tutor_id
- **No department_id** (need to add)

### roles table (8 roles)
| ID | Name |
|----|------|
| 1 | Admin |
| 2 | Tutor |
| 3 | Manager |
| 4 | Student |
| 5 | Moderator |
| 6 | Operation Manager |
| 7 | Accounts Manager |
| 8 | Administrative Manager |

**Note:** Plan adds "Admission Manager" as Support department head. Need to add this role.

---

## 3️⃣ WHAT DOES NOT EXIST (To Build)

### Database (NEW Tables)

| Table | Purpose |
|-------|---------|
| **departments** | Academic, Finance, Support |
| **tickets** | Ticket records (student, department, assigned_to, status, category) |
| **ticket_messages** | Conversation thread per ticket (or reuse messages with ticket_id) |
| **internal_notes** | Staff-only notes on tickets |

### users table addition
- **department_id** (nullable, FK → departments) — for Operation Manager, Accounts Manager, Admission Manager, Agents

---

## 4️⃣ UPGRADE STRATEGY (Following Plan)

### Principle: Coexist, Don't Replace

1. **Keep existing chat** (`conversations`, `messages`, FloatingChat, ChatBox, /chat)
   - Current direct messaging continues to work
   - No changes to existing dashboards

2. **Build NEW ticket system** in parallel
   - New tables: departments, tickets, ticket_messages, internal_notes
   - New routes: /api/tickets/*
   - New dashboards: /dashboard/tickets/* (or /dashboard/support/*)

3. **Floating Chat → Auto Ticket Creation** (Phase 2)
   - When student sends first message via Floating Chat:
     - Create ticket (category = "General" or from context)
     - Auto-route to department
     - Link ticket to conversation OR create ticket_messages from chat
   - This bridges old chat UI with new ticket system

---

## 5️⃣ DASHBOARD STRUCTURE (NEW - Per Plan)

### New Routes (Do NOT touch /dashboard/admin, /dashboard/tutor, /dashboard/student)

| Route | Purpose | Access |
|-------|---------|--------|
| /dashboard/tickets | Ticket dashboard (stats, list) | Super Admin, Managers, Agents |
| /dashboard/tickets/academic | Academic tickets | Operation Manager, Academic Agents, Tutor |
| /dashboard/tickets/finance | Finance tickets | Accounts Manager, Finance Agents |
| /dashboard/tickets/support | Support tickets | Admission Manager, Support Agents |
| /dashboard/tickets/[id] | Ticket detail (conversation, actions) | Department members |
| /dashboard/tickets/new | Create ticket (student) | Student |

**Sidebar (inside ticket dashboard):**
- Dashboard (overview)
- Academic
- Finance
- Support
- Reports
- Settings

---

## 6️⃣ IMPLEMENTATION PHASES (Recommended)

### Phase 1: Database & Backend (No UI Changes)
1. Create `departments` table + seed data
2. Add `department_id` to `users` (nullable)
3. Create `tickets` table
4. Create `ticket_messages` table (or decide: reuse messages with ticket_id)
5. Create `internal_notes` table
6. Add "Admission Manager" role
7. Create /api/tickets/* endpoints

### Phase 2: New Ticket Dashboards
1. Create /dashboard/tickets layout with sidebar
2. Build ticket list (filters: department, status)
3. Build ticket detail page (conversation, claim, escalate, resolve)
4. Build student "Create Ticket" form (with category)

### Phase 3: Auto-Routing & Permissions
1. Implement auto-routing by category
2. Implement role-based access (department_id match)
3. Implement claim system
4. Implement escalation system

### Phase 4: Floating Chat → Ticket Bridge
1. Modify Floating Chat: first message from student creates ticket
2. Show ticket ID in chat header
3. Route ticket to correct department based on context/category

### Phase 5: SLA, Analytics, Advanced (Optional)
1. SLA timer
2. Round-robin auto-assign
3. Satisfaction rating
4. Reports/analytics

---

## 7️⃣ FILES TO CREATE (New)

```
backend/
  migrations/
    create_departments_tickets_system.sql
  routes/
    tickets.js
  controllers/
    ticketController.js

app/dashboard/tickets/           # NEW dashboard (separate from admin/tutor/student)
  layout.tsx
  page.tsx                      # Overview / stats
  academic/
    page.tsx
  finance/
    page.tsx
  support/
    page.tsx
  [id]/
    page.tsx                    # Ticket detail
  new/
    page.tsx                    # Student create ticket
```

---

## 8️⃣ FILES TO KEEP UNCHANGED (Existing Dashboards)

- app/dashboard/admin/page.tsx
- app/dashboard/tutor/page.tsx
- app/dashboard/student/page.tsx
- app/dashboard/manager/page.tsx
- app/dashboard/moderator/page.tsx
- app/chat/page.tsx
- app/components/FloatingChatProvider.tsx
- app/components/FloatingChatWindow.tsx
- app/components/ChatBox.tsx
- app/components/MessageDropdown.tsx
- backend/routes/chat.js
- backend/controllers/chatController.js

---

## 9️⃣ SUMMARY

| Aspect | Current | Plan | Action |
|--------|---------|------|--------|
| Chat | Direct (student-tutor-admin) | Keep + add ticket creation | Coexist |
| Departments | None | 3 (Academic, Finance, Support) | Create new |
| Tickets | None | Full lifecycle | Create new |
| Dashboards | Admin, Tutor, Student, etc. | Unchanged | Create /dashboard/tickets |
| Roles | 8 roles | Add Admission Manager, Agents | Add role + department_id |
| Floating Chat | Opens conversation | First msg → create ticket | Modify (Phase 4) |

**Next Step:** Start Phase 1 (Database & Backend) when ready.
