"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ChatBox from "@/app/components/ChatBox";
import { User } from "@/app/components/types";

interface Conversation {
  id: number;
  student_id: number | null;
  tutor_id: number | null;
  admin_id: number | null;
  course_id: number | null;
  conversation_type: 'direct' | 'group' | 'course';
  title: string | null;
  student_name: string;
  tutor_name: string;
  admin_name: string;
  course_title: string;
  last_message: string | null;
  last_message_time: string | null;
  updated_at: string;
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    const userData: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(userData);
    fetchConversations(userData.id!);
  }, [router]);

  // Handle conversation query parameter
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === parseInt(conversationId));
      if (conv) {
        setSelectedConversation(conv);
        setShowSidebar(false); // Hide sidebar on mobile when conversation is selected from URL
      }
    }
  }, [searchParams, conversations]);

  const fetchConversations = async (userId: number) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/chat/conversations/${userId}`);
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
        if (data.conversations && data.conversations.length > 0) {
          // Check if there's a conversation ID in URL
          const conversationId = searchParams.get('conversation');
          if (conversationId) {
            const conv = data.conversations.find((c: Conversation) => c.id === parseInt(conversationId));
            if (conv) {
              setSelectedConversation(conv);
              setShowSidebar(false); // Hide sidebar on mobile
            } else {
              setSelectedConversation(data.conversations[0]);
            }
          } else {
            setSelectedConversation(data.conversations[0]);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/chat/users/all');
      const data = await res.json();
      if (data.success) {
        // Filter out current user
        const filteredUsers = (data.users || []).filter((u: any) => u.id !== user?.id);
        setAllUsers(filteredUsers);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const startNewConversation = async () => {
    if (!selectedUserId || !user) return;
    
    try {
      const selectedUser = allUsers.find(u => u.id === selectedUserId);
      if (!selectedUser) return;

      // Determine conversation participants based on roles
      const payload: any = {
        conversation_type: 'direct'
      };

      if (user.role === 'Admin') {
        payload.admin_id = user.id;
        if (selectedUser.role === 'Student') {
          payload.student_id = selectedUserId;
        } else if (selectedUser.role === 'Tutor') {
          payload.tutor_id = selectedUserId;
        }
      } else if (user.role === 'Tutor') {
        payload.tutor_id = user.id;
        if (selectedUser.role === 'Student') {
          payload.student_id = selectedUserId;
        } else if (selectedUser.role === 'Admin') {
          payload.admin_id = selectedUserId;
        }
      } else if (user.role === 'Student') {
        payload.student_id = user.id;
        if (selectedUser.role === 'Tutor') {
          payload.tutor_id = selectedUserId;
        } else if (selectedUser.role === 'Admin') {
          payload.admin_id = selectedUserId;
        }
      }

      const res = await fetch('http://localhost:5000/api/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setShowNewChatModal(false);
        setSelectedUserId(null);
        setSearchQuery('');
        // Refresh conversations
        await fetchConversations(user.id!);
        // Select the new conversation
        const newConv = conversations.find(c => c.id === data.conversation.id) || data.conversation;
        setSelectedConversation(newConv);
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
      alert("Failed to start conversation");
    }
  };

  const getConversationTitle = (conv: Conversation) => {
    if (conv.title) return conv.title;
    if (conv.conversation_type === 'course') return conv.course_title;
    
    // For direct messages, show the other person's name
    if (user?.id === conv.student_id) {
      // Current user is the student, show tutor or admin
      return conv.tutor_name !== 'Unknown' ? conv.tutor_name : conv.admin_name;
    } else if (user?.id === conv.tutor_id) {
      // Current user is the tutor, show student or admin
      return conv.student_name !== 'Unknown' ? conv.student_name : conv.admin_name;
    } else if (user?.id === conv.admin_id) {
      // Current user is the admin, show student or tutor
      return conv.student_name !== 'Unknown' ? conv.student_name : conv.tutor_name;
    }
    return 'Unknown';
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile: Show back to conversations button when chat is open */}
              {selectedConversation && (
                <button
                  onClick={() => {
                    setSelectedConversation(null);
                    setShowSidebar(true);
                  }}
                  className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">💬 Chat</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile: Toggle sidebar button */}
              {!selectedConversation && (
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => router.back()}
                className="hidden sm:flex px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] lg:h-[calc(100vh-80px)] relative">
        {/* Conversations Sidebar */}
        <div className={`${showSidebar ? 'flex' : 'hidden'} lg:flex absolute lg:relative inset-0 lg:inset-auto z-40 lg:z-auto w-full lg:w-80 bg-white border-r border-gray-200 overflow-y-auto flex-col`}>
          <div className="p-3 sm:p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Messages</h2>
              {/* Mobile: Close sidebar button */}
              <button
                onClick={() => setShowSidebar(false)}
                className="lg:hidden p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => {
                setShowNewChatModal(true);
                fetchAllUsers();
              }}
              className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] transition-colors"
            >
              + New Chat
            </button>
          </div>

          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-gray-400">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-xs sm:text-sm">No conversations yet</p>
            </div>
          ) : (
            <div>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversation(conv);
                    setShowSidebar(false); // Hide sidebar on mobile when conversation is selected
                  }}
                  className={`p-3 sm:p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm sm:text-base flex-shrink-0">
                      {getConversationTitle(conv).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                          {getConversationTitle(conv)}
                        </h3>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatTime(conv.last_message_time || conv.updated_at)}
                        </span>
                      </div>
                      {conv.last_message && (
                        <p className="text-xs sm:text-sm text-gray-600 truncate mt-1">
                          {conv.last_message}
                        </p>
                      )}
                      {conv.conversation_type === 'course' && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                          Course Chat
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${selectedConversation ? 'flex' : 'hidden lg:flex'}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 truncate">
                      {getConversationTitle(selectedConversation)}
                    </h2>
                    {selectedConversation.conversation_type === 'course' && (
                      <p className="text-xs sm:text-sm text-gray-500">Course Discussion</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-hidden">
                <ChatBox
                  conversationId={selectedConversation.id}
                  userId={user.id!}
                  userName={user.name || 'User'}
                  otherUserId={(() => {
                    // Determine the other user in this conversation
                    if (selectedConversation.student_id && selectedConversation.student_id !== user.id) {
                      return selectedConversation.student_id;
                    }
                    if (selectedConversation.tutor_id && selectedConversation.tutor_id !== user.id) {
                      return selectedConversation.tutor_id;
                    }
                    if (selectedConversation.admin_id && selectedConversation.admin_id !== user.id) {
                      return selectedConversation.admin_id;
                    }
                    return undefined;
                  })()}
                  otherUserName={getConversationTitle(selectedConversation)}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center text-gray-400">
                <svg className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mx-auto mb-3 sm:mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm sm:text-base lg:text-lg">Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Start New Chat</h3>
                <button
                  onClick={() => {
                    setShowNewChatModal(false);
                    setSelectedUserId(null);
                    setSearchQuery('');
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search User
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select User
                </label>
                <div className="max-h-48 sm:max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {allUsers
                    .filter(u => 
                      searchQuery === '' || 
                      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      u.email.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((u) => (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`p-2.5 sm:p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                          selectedUserId === u.id ? 'bg-blue-50 border-l-4 border-l-[#11CCEF]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm sm:text-base flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm sm:text-base font-medium text-gray-900 truncate">{u.name}</p>
                            <p className="text-xs sm:text-sm text-gray-500 truncate">{u.email}</p>
                          </div>
                          <span className={`text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex-shrink-0 ${
                            u.role === 'Student' ? 'bg-blue-100 text-blue-700' :
                            u.role === 'Tutor' ? 'bg-green-100 text-green-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {u.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  {allUsers.filter(u => 
                    searchQuery === '' || 
                    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.email.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 && (
                    <div className="p-6 sm:p-8 text-center text-gray-400">
                      <p className="text-sm sm:text-base">No users found</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 pt-4 border-t border-gray-200 mt-4">
                <button
                  onClick={() => {
                    setShowNewChatModal(false);
                    setSelectedUserId(null);
                    setSearchQuery('');
                  }}
                  className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={startNewConversation}
                  disabled={!selectedUserId}
                  className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] active:bg-[#0b9bc7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}

