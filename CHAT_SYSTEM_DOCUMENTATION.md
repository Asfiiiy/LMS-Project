# 💬 LMS Chat System - Complete Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [User Capabilities](#user-capabilities)
5. [Technical Implementation](#technical-implementation)
6. [Modern Chat Features](#modern-chat-features)
7. [How to Use](#how-to-use)
8. [API Endpoints](#api-endpoints)
9. [Socket Events](#socket-events)
10. [Database Schema](#database-schema)

---

## 🎯 Overview

The LMS Chat System is a **modern, real-time messaging platform** built into the Learning Management System. It enables seamless communication between **Students, Tutors, and Admins** with features comparable to WhatsApp, Telegram, and Slack.

### Key Highlights:
- ✅ **Real-time messaging** using Socket.IO
- ✅ **Role-based access control**
- ✅ **File sharing** (images, PDFs, documents)
- ✅ **Online/Offline status tracking**
- ✅ **Typing indicators**
- ✅ **Read receipts** (seen/unseen)
- ✅ **Last seen timestamps**
- ✅ **Modern UI/UX** with animations

---

## 🚀 Features

### 1. **Real-Time Messaging** 📨
- Instant message delivery using WebSocket (Socket.IO)
- No page refresh required
- Messages appear immediately for both sender and receiver
- Supports text messages and rich content

### 2. **File Sharing** 📎
- Upload and share multiple file types:
  - 🖼️ **Images** (JPEG, PNG, GIF, WebP)
  - 📄 **PDFs** (viewable inline)
  - 📝 **Documents** (.doc, .docx, .txt)
  - 🗜️ **Archives** (.zip)
- **Maximum file size:** 10MB
- Files stored on **Cloudinary CDN** for fast delivery
- Preview images directly in chat
- Download files with one click

### 3. **Online/Offline Status** 🟢🔴
- Real-time online status indicators
- Green dot with pulse animation = User is online
- Gray dot = User is offline
- Automatic status updates when users connect/disconnect
- Works across all browser tabs

### 4. **Typing Indicators** ⌨️
- Shows "{User Name} is typing..." when someone is typing
- Animated bouncing dots (● ● ●)
- Auto-hides after 2 seconds of inactivity
- Only visible to other participants (not yourself)

### 5. **Read Receipts (Seen)** ✓✓
- **Single gray checkmark (✓)** = Message delivered
- **Double blue checkmarks (✓✓)** = Message read/seen
- Real-time updates when recipient reads your message
- Similar to WhatsApp read receipts

### 6. **Last Seen Timestamp** 🕐
- Shows when offline users were last active
- Smart time formatting:
  - "Just now" (< 1 minute)
  - "5m ago" (< 1 hour)
  - "2h ago" (< 24 hours)
  - "3d ago" (< 7 days)
  - Full date for older timestamps
- Visible in chat header

### 7. **User-Friendly Interface** 🎨
- Modern, clean design with gradients
- Smooth animations and transitions
- Mobile-responsive layout
- Color-coded messages (sent vs received)
- Avatar with initials
- Timestamps for each message

### 8. **Conversation Management** 💭
- View all your conversations in one place
- See last message preview
- Start new conversations with students/tutors/admins
- Search and filter users
- Conversation list with user names and roles

### 9. **Role-Based Access Control** 🔐
- **Students** can only chat with their tutors
- **Tutors** can chat with students and admins
- **Admins** can chat with everyone
- Automatic filtering based on user role

### 10. **Auto-Scroll** 📜
- Automatically scrolls to latest message
- Smooth scrolling animation
- Triggers on new messages and when typing

---

## 🏗️ Architecture

### Technology Stack

```
┌─────────────────────────────────────┐
│         Frontend (React)            │
│  - Next.js 16 with TypeScript       │
│  - Socket.IO Client                 │
│  - Tailwind CSS                     │
│  - Real-time state management       │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│      Backend (Node.js/Express)      │
│  - Socket.IO Server                 │
│  - RESTful API endpoints            │
│  - MySQL database                   │
│  - Cloudinary integration           │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│         Storage & CDN               │
│  - MySQL (messages, metadata)       │
│  - Cloudinary (file storage)        │
└─────────────────────────────────────┘
```

### Communication Flow

```
User Action → Frontend (React) → Socket.IO → Backend → Database
                    ↑                                       ↓
                    ←─────── Real-time Broadcast ──────────┘
```

---

## 👥 User Capabilities

### Student 👨‍🎓
**Can Chat With:**
- ✅ Tutors (from enrolled courses)
- ❌ Other students (restricted)
- ❌ Admins (restricted)

**Features:**
- View all conversations with tutors
- Send text messages and files
- See tutor online status
- Receive read receipts
- Quick access from dashboard via "Chat with Tutor" button

**Access Points:**
1. Dashboard → Quick Actions → "Chat with Tutor"
2. Direct link: `/chat`

---

### Tutor 👨‍🏫
**Can Chat With:**
- ✅ Students (from their courses)
- ✅ Admins
- ✅ Other tutors

**Features:**
- View all student conversations
- Send messages and files
- See student online status
- Track message read status
- Manage multiple conversations

**Access Points:**
1. Dashboard → Chat tab → "Open Chat"
2. Direct link: `/chat`

---

### Admin 👨‍💼
**Can Chat With:**
- ✅ Students
- ✅ Tutors
- ✅ Other admins

**Features:**
- Full access to all conversations
- Send messages and files
- Monitor all user interactions
- Broadcast capabilities
- User management

**Access Points:**
1. Dashboard → Chat tab → Direct link
2. Direct link: `/chat`

---

## 🛠️ Technical Implementation

### Frontend Components

#### 1. **ChatBox Component** (`app/components/ChatBox.tsx`)
Main chat interface component.

**Props:**
```typescript
interface ChatBoxProps {
  conversationId: number;     // Conversation ID
  userId: number;             // Current user ID
  userName: string;           // Current user name
  otherUserId?: number;       // Other participant's ID
  otherUserName?: string;     // Other participant's name
}
```

**State Management:**
```typescript
- messages: Message[]               // Chat messages
- newMessage: string               // Current input
- isOnline: boolean                // Other user online status
- lastSeen: string | null          // Last seen timestamp
- typingUser: string | null        // Who is typing
- readMessages: Set<number>        // Read message IDs
- uploading: boolean               // File upload status
```

**Key Functions:**
- `sendMessage()` - Send text message
- `handleFileUpload()` - Upload and send file
- `markMessageAsRead()` - Mark message as seen
- `handleTyping()` - Emit typing indicator
- `formatLastSeen()` - Format timestamp

---

#### 2. **Chat Page** (`app/chat/page.tsx`)
Main chat interface page.

**Features:**
- Conversation list (left sidebar)
- Selected chat view (right panel)
- New chat modal
- User search and filter
- Auto-refresh conversations

**State:**
```typescript
- conversations: Conversation[]    // All conversations
- selectedConversation: Conversation | null
- allUsers: User[]                // Available users
- showNewChatModal: boolean       // Modal visibility
```

---

### Backend Components

#### 1. **Socket.IO Server** (`backend/socket.js`)

**Features:**
- User presence tracking
- Real-time message broadcasting
- Typing indicators
- Read receipts
- Online/offline status

**In-Memory Store:**
```javascript
onlineUsers: Map<userId, {
  socketId: string,
  userName: string,
  lastSeen: string
}>
```

**Socket Events:** (See Socket Events section below)

---

#### 2. **Chat Controller** (`backend/controllers/chatController.js`)

**Functions:**
```javascript
- startConversation()      // Create/retrieve conversation
- getUserConversations()   // Get user's chat list
- getMessages()            // Fetch conversation messages
- sendMessage()            // Save message to DB
- uploadFile()             // Upload to Cloudinary
- markAsRead()             // Update read status
- getAllUsers()            // Get available users
```

---

#### 3. **Chat Routes** (`backend/routes/chat.js`)

**Endpoints:**
```javascript
POST   /api/chat/start              // Start new conversation
GET    /api/chat/conversations/:userId  // Get user conversations
GET    /api/chat/users/all          // Get all users
GET    /api/chat/:conversationId    // Get messages
POST   /api/chat/message            // Send message
POST   /api/chat/upload             // Upload file
POST   /api/chat/mark-read          // Mark as read
```

---

## 🌟 Modern Chat Features

### Feature Comparison

| Feature | WhatsApp | Telegram | Slack | **Our LMS** |
|---------|----------|----------|-------|-------------|
| Real-time Messaging | ✅ | ✅ | ✅ | ✅ |
| Online Status | ✅ | ✅ | ✅ | ✅ |
| Typing Indicator | ✅ | ✅ | ✅ | ✅ |
| Read Receipts | ✅ | ✅ | ✅ | ✅ |
| Last Seen | ✅ | ✅ | ✅ | ✅ |
| File Sharing | ✅ | ✅ | ✅ | ✅ |
| Image Preview | ✅ | ✅ | ✅ | ✅ |
| PDF Viewer | ✅ | ✅ | ✅ | ✅ |
| Search Users | ✅ | ✅ | ✅ | ✅ |
| Role-Based Access | ❌ | ❌ | ✅ | ✅ |

---

## 📖 How to Use

### For Students:

#### Starting a Chat:
1. Login to your student dashboard
2. Click "Chat with Tutor" in Quick Actions
3. Select a tutor from your enrolled courses
4. Start typing your message!

#### Sending Files:
1. Open a conversation
2. Click the 📎 attachment icon
3. Select file (max 10MB)
4. File uploads automatically

---

### For Tutors:

#### Accessing Chat:
1. Login to tutor dashboard
2. Click "Chat" tab
3. Click "Open Chat" button
4. Select a conversation or start new chat

#### Chatting with Students:
1. Click "+ New Chat"
2. Search for student name
3. Select student
4. Start conversation

---

### For Admins:

#### Full Access:
1. Login to admin dashboard
2. Click "Chat" tab
3. Redirects to full chat interface
4. Chat with any user (students, tutors, admins)

---

## 🔌 API Endpoints

### 1. Start Conversation
```http
POST /api/chat/start
Content-Type: application/json

{
  "student_id": 10,
  "tutor_id": 2
}

Response:
{
  "success": true,
  "conversation": {
    "id": 1,
    "student_id": 10,
    "tutor_id": 2,
    "conversation_type": "direct",
    ...
  }
}
```

---

### 2. Get User Conversations
```http
GET /api/chat/conversations/:userId

Response:
{
  "success": true,
  "conversations": [
    {
      "id": 1,
      "student_name": "Sam Student",
      "tutor_name": "Tom Tutor",
      "last_message": "Hello!",
      "last_message_at": "2025-01-12T10:30:00Z",
      ...
    }
  ]
}
```

---

### 3. Get Messages
```http
GET /api/chat/:conversationId

Response:
{
  "success": true,
  "messages": [
    {
      "id": 1,
      "sender_id": 10,
      "sender_name": "Sam Student",
      "message": "Hello!",
      "created_at": "2025-01-12T10:30:00Z",
      "is_read": 1,
      ...
    }
  ]
}
```

---

### 4. Send Message
```http
POST /api/chat/message
Content-Type: application/json

{
  "conversationId": 1,
  "senderId": 10,
  "message": "Hello!",
  "messageType": "text"
}

Response:
{
  "success": true,
  "message": {
    "id": 123,
    "conversation_id": 1,
    "sender_id": 10,
    "message": "Hello!",
    ...
  }
}
```

---

### 5. Upload File
```http
POST /api/chat/upload
Content-Type: multipart/form-data

Form Data:
- file: [binary file data]

Response:
{
  "success": true,
  "url": "https://res.cloudinary.com/...",
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "fileSize": 2048000
}
```

---

### 6. Mark as Read
```http
POST /api/chat/mark-read
Content-Type: application/json

{
  "messageId": 123,
  "userId": 10
}

Response:
{
  "success": true
}
```

---

### 7. Get All Users
```http
GET /api/chat/users/all

Response:
{
  "success": true,
  "users": [
    {
      "id": 1,
      "name": "Alice Admin",
      "email": "admin@example.com",
      "role": "Admin"
    },
    ...
  ]
}
```

---

## ⚡ Socket Events

### Client → Server Events

#### 1. User Online
```javascript
socket.emit("user_online", {
  userId: 10,
  userName: "Sam Student"
});
```

#### 2. Join Conversation
```javascript
socket.emit("join_conversation", {
  conversationId: 1,
  userId: 10
});
```

#### 3. Send Message
```javascript
socket.emit("send_message", {
  conversationId: 1,
  message: messageObject
});
```

#### 4. Typing
```javascript
socket.emit("typing", {
  conversationId: 1,
  userName: "Sam Student",
  userId: 10
});
```

#### 5. Stop Typing
```javascript
socket.emit("stop_typing", {
  conversationId: 1,
  userId: 10
});
```

#### 6. Message Read
```javascript
socket.emit("message_read", {
  conversationId: 1,
  messageId: 123,
  userId: 10
});
```

#### 7. Get Online Users
```javascript
socket.emit("get_online_users");
```

---

### Server → Client Events

#### 1. User Status Change
```javascript
socket.on("user_status_change", (data) => {
  // data: { userId, userName, status, lastSeen }
});
```

#### 2. Online Users List
```javascript
socket.on("online_users_list", (users) => {
  // users: [{ userId, userName, status }]
});
```

#### 3. Receive Message
```javascript
socket.on("receive_message", (message) => {
  // message: { id, sender_id, message, ... }
});
```

#### 4. User Typing
```javascript
socket.on("user_typing", (data) => {
  // data: { userName, userId, conversationId }
});
```

#### 5. User Stop Typing
```javascript
socket.on("user_stop_typing", (data) => {
  // data: { userId, conversationId }
});
```

#### 6. Message Seen
```javascript
socket.on("message_seen", (data) => {
  // data: { messageId, userId, seenAt }
});
```

---

## 🗄️ Database Schema

### 1. `conversations` Table
Stores chat conversations.

```sql
CREATE TABLE conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NULL,                    -- NULL for admin-tutor chats
  tutor_id INT NULL,                      -- NULL for admin-student chats
  admin_id INT NULL,                      -- NULL for student-tutor chats
  course_id INT NULL,                     -- For course-based chats
  conversation_type ENUM('direct', 'group', 'course') DEFAULT 'direct',
  title VARCHAR(255) NULL,                -- For group chats
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP NULL,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
```

---

### 2. `messages` Table
Stores chat messages.

```sql
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  message TEXT NULL,
  file_url VARCHAR(500) NULL,             -- Cloudinary URL
  file_name VARCHAR(255) NULL,
  file_type VARCHAR(100) NULL,
  file_size BIGINT NULL,
  message_type ENUM('text', 'file', 'image', 'pdf') DEFAULT 'text',
  is_read TINYINT(1) DEFAULT 0,
  read_at TIMESTAMP NULL,
  is_deleted TINYINT(1) DEFAULT 0,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_conversation (conversation_id),
  INDEX idx_sender (sender_id)
);
```

---

### 3. `message_read_receipts` Table
Tracks who read which messages (for group chats).

```sql
CREATE TABLE message_read_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_read_receipt (message_id, user_id)
);
```

---

### 4. `conversation_participants` Table
For group chats (future feature).

```sql
CREATE TABLE conversation_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('admin', 'member') DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_participant (conversation_id, user_id)
);
```

---

## 🎨 UI/UX Features

### Visual Elements

#### 1. **Chat Header**
```
┌─────────────────────────────────────┐
│  [Avatar]  Alice Admin              │
│            🟢 Online                │
└─────────────────────────────────────┘
```

#### 2. **Message Bubble (Sent)**
```
                    ┌──────────────────┐
                    │ Hello there!     │
                    │                  │
                    │ 12:34 PM ✓✓     │
                    └──────────────────┘
                         (Blue, right-aligned)
```

#### 3. **Message Bubble (Received)**
```
┌──────────────────┐
│ Tom Tutor        │
│ Hi! How are you? │
│                  │
│ 12:35 PM         │
└──────────────────┘
    (Gray, left-aligned)
```

#### 4. **Typing Indicator**
```
● ● ● Alice Admin is typing...
  (Animated bouncing dots)
```

#### 5. **File Message**
```
┌─────────────────────────────────┐
│ [📄] document.pdf              │
│ Click to view/download          │
└─────────────────────────────────┘
```

---

### Color Scheme

```css
Primary Blue:    #11CCEF (Cyan)
Secondary Blue:  #0daed9 (Darker Cyan)
Success Green:   #10B981 (Online)
Error Red:       #EF4444
Gray:            #6B7280 (Offline)

Message Sent:    Blue gradient
Message Received: Light gray
```

---

### Animations

1. **Online Status Pulse**
   - Green dot with pulse animation
   - CSS: `animate-pulse`

2. **Typing Dots**
   - 3 dots bouncing in sequence
   - Delays: 0ms, 150ms, 300ms

3. **Message Appear**
   - Smooth fade-in
   - Scroll animation

4. **Button Hover**
   - Scale: 1.05
   - Transition: 300ms

---

## 🔒 Security Features

### 1. **Role-Based Access Control**
- Students can only chat with tutors from enrolled courses
- Tutors can chat with their students and admins
- Admins have full access

### 2. **File Validation**
- Maximum file size: 10MB
- Allowed types: images, PDFs, documents, archives
- MIME type checking

### 3. **Data Sanitization**
- Input validation on backend
- XSS protection
- SQL injection prevention (parameterized queries)

### 4. **Authentication**
- User must be logged in
- Session validation
- Token-based authentication (if implemented)

---

## 📊 Performance Optimizations

### 1. **In-Memory Storage**
- Online users stored in Map (O(1) lookup)
- Fast presence tracking

### 2. **Socket Rooms**
- Messages only sent to conversation participants
- Reduces unnecessary broadcasts

### 3. **Debounced Typing**
- Typing indicator stops after 2s inactivity
- Prevents excessive socket emissions

### 4. **Read Receipt Batching**
- Prevents spam from multiple read events
- Efficient database updates

### 5. **CDN for Files**
- Cloudinary CDN for fast file delivery
- Reduced server load
- Global edge locations

### 6. **Auto-Scroll Optimization**
- 100ms debounce
- Smooth scroll behavior
- Only triggers on new messages

---

## 🐛 Troubleshooting

### Common Issues:

#### 1. **Messages not appearing in real-time**
**Solution:**
- Check if backend Socket.IO server is running
- Verify frontend is connecting to correct port (5000)
- Check browser console for connection errors

#### 2. **"Unknown" showing instead of user names**
**Solution:**
- Ensure conversation has valid user IDs
- Check `getConversationTitle()` logic
- Verify database has user names

#### 3. **File upload failing**
**Solution:**
- Check file size (max 10MB)
- Verify Cloudinary credentials in backend
- Check file type is allowed

#### 4. **Online status not updating**
**Solution:**
- Ensure `user_online` event is emitted on connect
- Check `onlineUsers` Map in backend
- Verify Socket.IO connection is stable

#### 5. **Read receipts not working**
**Solution:**
- Ensure `message_read` event is emitted
- Check message IDs are valid
- Verify database `is_read` column updates

---

## 🚀 Future Enhancements

### Planned Features:

1. **Group Chats** 👥
   - Course-based group discussions
   - Multiple participants
   - Admin/moderator roles

2. **Voice Messages** 🎤
   - Record and send audio
   - Play inline in chat

3. **Video Calls** 📹
   - One-on-one video conferencing
   - Screen sharing

4. **Message Search** 🔍
   - Search within conversations
   - Filter by date, sender, type

5. **Message Reactions** 😊
   - Emoji reactions
   - Quick responses

6. **Message Forwarding** ↪️
   - Forward to other conversations
   - Share files easily

7. **Push Notifications** 🔔
   - Browser notifications
   - Mobile app notifications

8. **Message Editing** ✏️
   - Edit sent messages
   - Show "edited" indicator

9. **Message Deletion** 🗑️
   - Delete for me
   - Delete for everyone

10. **Chat Export** 📥
    - Export conversation history
    - PDF/CSV format

---

## 📝 Summary

### What You Get:

✅ **Modern chat system** comparable to WhatsApp/Telegram  
✅ **Real-time messaging** with Socket.IO  
✅ **Role-based access** for students, tutors, admins  
✅ **File sharing** with Cloudinary integration  
✅ **Online status** tracking  
✅ **Typing indicators** with user names  
✅ **Read receipts** (single/double checkmarks)  
✅ **Last seen** timestamps  
✅ **Beautiful UI** with animations  
✅ **Mobile responsive** design  
✅ **Fast and efficient** with optimizations  

---

## 📞 Support

For questions or issues:
1. Check this documentation first
2. Review error logs in browser console
3. Check backend server logs
4. Verify database schema is correct

---

**Built with ❤️ for the LMS Project**

*Last Updated: November 12, 2025*

