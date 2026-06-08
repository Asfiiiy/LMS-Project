'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import { showToast } from '@/app/components/Toast';

interface User {
  id: number;
  name: string;
  email: string;
  learner_id?: string | null;
  role_id: number;
  role_name: string;
  manager_id: number | null;
  manager_name: string | null;
  parent_tutor_id: number | null;
  parent_tutor_name: string | null;
  assigned_tutor_id: number | null;
  assigned_tutor_name: string | null;
  created_at: string;
}

interface Manager {
  id: number;
  name: string;
  email: string;
  role_name: string;
}

interface Tutor {
  id: number;
  name: string;
  email: string;
  parent_tutor_id: number | null;
  parent_tutor_name: string | null;
}

interface Role {
  id: number;
  name: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const UserManagement = () => {
  const router = useRouter();
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]); // Store ALL users
  const [roles, setRoles] = useState<Role[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Client-side pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  
  // Staff roles shown in "Staff Manager" tab (includes Certificate Manager, Operation Manager, etc.)
  const STAFF_MANAGER_ROLES = ['Certificate Manager', 'Claim Manager', 'Consultation Manager', 'Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager', 'Team Member'];

  // Role tab state
  const [selectedTab, setSelectedTab] = useState<'all' | 'admin' | 'tutor' | 'student' | 'manager' | 'moderator' | 'staff_manager'>('all');
  const [expandedTutorId, setExpandedTutorId] = useState<number | null>(null);
  const [tutorStudents, setTutorStudents] = useState<{[key: number]: User[]}>({});

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    learner_id: '',
    password: '',
    role_id: '',
    manager_id: '',
    parent_tutor_id: '',
    assigned_tutor_id: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const isStudentRoleSelected = () => {
    const selectedRole = roles.find(role => role.id.toString() === formData.role_id);
    return !!selectedRole && ['Student', 'ManagerStudent', 'InstituteStudent'].includes(selectedRole.name);
  };

  // Get current user role and impersonation status
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
      setCurrentUserRole(user?.role || null);
      setIsImpersonating(!!localStorage.getItem('lms-impersonating'));
    } catch {
      setCurrentUserRole(null);
      setIsImpersonating(false);
    }
  }, []);

  // Fetch all users only once on mount
  useEffect(() => {
    fetchData();
  }, []);
  
  // Reset to page 1 when search, filter, or tab changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterRole, selectedTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Test admin API first
      await apiService.testAdminApi();
      
      // Fetch ALL users at once (using a large limit to get all users)
      const [usersData, rolesData, managersData, tutorsData] = await Promise.all([
        apiService.getUsers(1, 50000), // Fetch all users with a large limit (backend cap: 50000)
        apiService.getRoles(),
        apiService.getManagers(),
        apiService.getTutors()
      ]);

      if (usersData.success) {
        setAllUsers(usersData.users);
      }
      if (rolesData.success) {
        setRoles(rolesData.roles);
      }
      if (managersData.success) {
        setManagers(managersData.managers);
      }
      if (tutorsData.success) {
        setTutors(tutorsData.tutors);
      }
    } catch (error) {
      setError('Failed to connect to admin API. Please restart the backend server.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiService.createUser(formData);
      if (data.success) {
        // Reset to first page and refresh
        setPage(1);
        fetchData();
        setShowCreateForm(false);
        setFormData({ name: '', email: '', learner_id: '', password: '', role_id: '', manager_id: '', parent_tutor_id: '', assigned_tutor_id: '' });
        setShowPassword(false);
        showToast('User created successfully!', 'success');
      } else {
        showToast(data.message || 'Error creating user', 'error');
      }
    } catch (error) {
      showToast('Error creating user', 'error');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    try {
      const data = await apiService.updateUser(editingUser!.id, formData);
      if (data.success) {
        fetchData();
        setEditingUser(null);
        setFormData({ name: '', email: '', learner_id: '', password: '', role_id: '', manager_id: '', parent_tutor_id: '', assigned_tutor_id: '' });
        setShowPassword(false);
        showToast('User updated successfully!', 'success');
      } else {
        showToast(data.message || 'Error updating user', 'error');
      }
    } catch (error) {
      showToast('Error updating user', 'error');
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
    setDeleteError(null);
    setDeleteSuccess(false);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    
    setDeleting(true);
    setDeleteError(null);
    setDeleteSuccess(false);
    
    try {
      const data = await apiService.deleteUser(userToDelete.id);
      if (data.success) {
        fetchData();
        setDeleteSuccess(true);
        setShowDeleteModal(false);
        setUserToDelete(null);
        // Auto-close success message after 2 seconds
        setTimeout(() => {
          setDeleteSuccess(false);
        }, 2000);
      } else {
        setDeleteError(data.message || 'Error deleting user');
      }
    } catch (error: any) {
      // Show the actual error message from the API if available
      const errorMessage = error?.message || error?.response?.data?.message || 'Error deleting user. Please check the console for details.';
      setDeleteError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
    setDeleteError(null);
  };

  const getDashboardPathForRole = (role: string) => {
    const r = (role || '').toLowerCase();
    if (role === 'Admin' || r === 'admin') return '/dashboard/admin';
    if (role === 'Assessor' || r === 'assessor') return '/dashboard/tutor';
    if (role === 'Manager' || r === 'manager') return '/dashboard/manager';
    if (role === 'Moderator' || r === 'moderator') return '/dashboard/moderator';
    if (['Student', 'ManagerStudent', 'InstituteStudent'].includes(role) || ['student', 'managerstudent', 'institutestudent'].includes(r)) return '/dashboard/student';
    if (role === 'Certificate Manager' || r === 'certificate manager') return '/dashboard/certificate-manager';
    if (role === 'Claim Manager' || r === 'claim manager') return '/dashboard/claim-manager';
    if (role === 'Consultation Manager' || r === 'consultation manager') return '/dashboard/consultation-manager';
    if (['Operation Manager', 'Accounts Manager', 'Administrative Manager', 'Admission Manager', 'Team Member'].includes(role)) return '/dashboard/tickets';
    return '/dashboard/tickets';
  };

  const handleLoginAs = async (user: User) => {
    if (currentUserRole !== 'Admin') return;
    try {
      const res = await apiService.impersonateUser(user.id);
      if (res?.success && res.token && res.user) {
        const { persistLoginCredentials } = await import('@/app/utils/authStorage');
        persistLoginCredentials(res.token, JSON.stringify(res.user));
        try {
          localStorage.setItem('lms-impersonating', JSON.stringify({ name: user.name, role: user.role_name }));
        } catch {
          /* storage may be blocked */
        }
        // No auth-change dispatch: full reload loads fresh session and avoids mid-navigation state chaos
        showToast(`Logged in as ${user.name}`, 'success');
        window.location.href = getDashboardPathForRole(res.user.role || user.role_name);
      } else {
        showToast(res?.message || 'Impersonation failed', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Impersonation failed', 'error');
    }
  };

  // Fetch students for a specific tutor
  const fetchTutorStudents = async (tutorId: number) => {
    if (tutorStudents[tutorId]) {
      // Already fetched
      return;
    }
    
    try {
      const students = allUsers.filter(user => 
        user.role_name === 'Student' && user.assigned_tutor_id === tutorId
      );
      setTutorStudents(prev => ({ ...prev, [tutorId]: students }));
    } catch {
      // no-op
    }
  };
  
  // Toggle tutor expansion
  const toggleTutorExpansion = (tutorId: number) => {
    if (expandedTutorId === tutorId) {
      setExpandedTutorId(null);
    } else {
      setExpandedTutorId(tutorId);
      fetchTutorStudents(tutorId);
    }
  };

  // Client-side filtering (for search, role filter, and tab)
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.learner_id || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || user.role_name === filterRole;
    
    // Tab filtering
    let matchesTab = true;
    if (selectedTab !== 'all') {
      if (selectedTab === 'staff_manager') {
        matchesTab = STAFF_MANAGER_ROLES.includes(user.role_name);
      } else {
        const tabRoleMap: {[key: string]: string} = {
          'admin': 'Admin',
          'tutor': 'Assessor',
          'student': 'Student',
          'manager': 'Manager',
          'moderator': 'Moderator'
        };
        matchesTab = user.role_name === tabRoleMap[selectedTab];
      }
    }
    
    return matchesSearch && matchesRole && matchesTab;
  });

  // Client-side pagination
  const totalPages = Math.ceil(filteredUsers.length / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Calculate display range
  const displayRange = {
    start: filteredUsers.length > 0 ? startIndex + 1 : 0,
    end: Math.min(endIndex, filteredUsers.length),
    total: filteredUsers.length
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Handle limit change
  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // Reset to first page when changing limit
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (page > 3) {
        pages.push('...');
      }

      // Show pages around current page
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-100 text-red-800';
      case 'Assessor': return 'bg-blue-100 text-blue-800';
      case 'Manager': return 'bg-green-100 text-green-800';
      case 'Student': return 'bg-purple-100 text-purple-800';
      case 'Moderator': return 'bg-yellow-100 text-yellow-800';
      case 'Certificate Manager': return 'bg-amber-100 text-amber-800';
      case 'Claim Manager': return 'bg-emerald-100 text-emerald-800';
      case 'Consultation Manager': return 'bg-cyan-100 text-cyan-900';
      case 'Operation Manager': return 'bg-indigo-100 text-indigo-800';
      case 'Accounts Manager': return 'bg-teal-100 text-teal-800';
      case 'Administrative Manager': return 'bg-slate-100 text-slate-800';
      case 'Admission Manager': return 'bg-cyan-100 text-cyan-800';
      case 'Team Member': return 'bg-sky-100 text-sky-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="text-red-600 text-lg mr-3">⚠️</div>
          <div>
            <h3 className="text-red-800 font-semibold">Connection Error</h3>
            <p className="text-red-600 mt-1">{error}</p>
            <button 
              onClick={fetchData}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">User Management</h2>
        <button
          onClick={() => {
            setShowCreateForm(true);
            setShowPassword(false);
            setFormData({ name: '', email: '', learner_id: '', password: '', role_id: '', manager_id: '', parent_tutor_id: '', assigned_tutor_id: '' });
          }}
          className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] transition-colors"
        >
          + Add New User
        </button>
      </div>

      {/* Role Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {[
            { key: 'all', label: 'All Users', icon: '👥', count: allUsers.length },
            { key: 'admin', label: 'Admins', icon: '👑', count: allUsers.filter(u => u.role_name === 'Admin').length },
            { key: 'tutor', label: 'Assessors', icon: '👨‍🏫', count: allUsers.filter(u => u.role_name === 'Assessor').length },
            { key: 'student', label: 'Students', icon: '🎓', count: allUsers.filter(u => u.role_name === 'Student').length },
            { key: 'staff_manager', label: 'Staff Manager', icon: '👔', count: allUsers.filter(u => STAFF_MANAGER_ROLES.includes(u.role_name)).length },
            { key: 'manager', label: 'Managers', icon: '💼', count: allUsers.filter(u => u.role_name === 'Manager').length },
            { key: 'moderator', label: 'Moderators', icon: '🛡️', count: allUsers.filter(u => u.role_name === 'Moderator').length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as any)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
                selectedTab === tab.key
                  ? 'bg-[#11CCEF] text-white border-b-2 border-[#11CCEF]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  selectedTab === tab.key
                    ? 'bg-white text-[#11CCEF]'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {tab.count}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Content area - light pink and blue gradient below tabs */}
      <div className="bg-gradient-to-br from-cyan-50/60 via-white to-pink-50/60 rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Filters */}
      <div className="bg-white/70 backdrop-blur-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Users / Learner ID</label>
            <input
              type="text"
              placeholder="Search by name, email, or learner ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
            >
              <option value="">All Roles</option>
              {roles.map(role => (
                <option key={role.id} value={role.name}>{role.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tutors Tab - Special Card View */}
      <div className="p-4">
      {selectedTab === 'tutor' ? (
        <div className="space-y-4">
          {/* Tutor Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="text-sm font-medium text-blue-600">Total Assessors</div>
              <div className="text-3xl font-bold text-blue-900 mt-2">{filteredUsers.length}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="text-sm font-medium text-purple-600">Main Assessors</div>
              <div className="text-3xl font-bold text-purple-900 mt-2">
                {filteredUsers.filter(u => !u.parent_tutor_id).length}
              </div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200">
              <div className="text-sm font-medium text-indigo-600">Sub-Assessors</div>
              <div className="text-3xl font-bold text-indigo-900 mt-2">
                {filteredUsers.filter(u => u.parent_tutor_id).length}
              </div>
            </div>
          </div>

          {/* Tutors List */}
          <div className="space-y-3">
            {paginatedUsers.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
                No assessors found
              </div>
            ) : (
              paginatedUsers.map((tutor) => {
                const studentsList = tutorStudents[tutor.id] || [];
                const studentCount = allUsers.filter(u => u.role_name === 'Student' && u.assigned_tutor_id === tutor.id).length;
                const subTutorCount = allUsers.filter(u => u.role_name === 'Assessor' && u.parent_tutor_id === tutor.id).length;
                const isExpanded = expandedTutorId === tutor.id;

                return (
                  <div
                    key={tutor.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md"
                  >
                    {/* Tutor Header */}
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-white border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold text-lg">
                            {tutor.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-gray-900">{tutor.name}</h3>
                              {!tutor.parent_tutor_id && (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                                  Main Assessor
                                </span>
                              )}
                              {tutor.parent_tutor_id && (
                                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded">
                                  Sub-Assessor
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{tutor.email}</p>
                            {tutor.parent_tutor_name && (
                              <p className="text-xs text-gray-500 mt-1">
                                👤 Reports to: <span className="font-medium">{tutor.parent_tutor_name}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          {/* Statistics */}
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-blue-600">{studentCount}</div>
                              <div className="text-xs text-gray-500">Students</div>
                            </div>
                            {!tutor.parent_tutor_id && (
                              <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">{subTutorCount}</div>
                                <div className="text-xs text-gray-500">Sub-Assessors</div>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {studentCount > 0 && (
                              <button
                                onClick={() => toggleTutorExpansion(tutor.id)}
                                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                              >
                                {isExpanded ? '▲ Hide' : '▼ View'} Students
                              </button>
                            )}
                            {currentUserRole === 'Admin' && (
                              <button
                                onClick={() => handleLoginAs(tutor)}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-pink-50 text-pink-700 border border-pink-200 hover:bg-pink-100 hover:border-pink-300 transition-colors"
                                title="Login as this user"
                              >
                                🔑 Login As
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingUser(tutor);
                                setShowPassword(false);
                                setFormData({
                                  name: tutor.name,
                                  email: tutor.email,
                                  learner_id: tutor.learner_id || '',
                                  password: '',
                                  role_id: tutor.role_id.toString(),
                                  manager_id: tutor.manager_id?.toString() || '',
                                  parent_tutor_id: tutor.parent_tutor_id?.toString() || '',
                                  assigned_tutor_id: tutor.assigned_tutor_id?.toString() || ''
                                });
                              }}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 hover:border-cyan-300 transition-colors"
                            >
                              ✏️ Edit
                            </button>
                            {!isImpersonating && (
                              <button
                                onClick={() => handleDeleteClick(tutor)}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300 transition-colors"
                              >
                                🗑️ Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Students List */}
                    {isExpanded && studentsList.length > 0 && (
                      <div className="p-4 bg-gray-50">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                          📚 Assigned Students ({studentsList.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {studentsList.map((student) => (
                            <div
                              key={student.id}
                              className="bg-white rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-semibold">
                                  {student.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{student.name}</p>
                                  <p className="text-xs text-gray-500 truncate">{student.email}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination for Tutors */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 py-4">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-500 text-white hover:bg-blue-600"
              >
                ← Previous
              </button>
              <span className="px-4 py-2 text-sm font-medium text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-500 text-white hover:bg-blue-600"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Regular Users Table for Other Tabs */
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm overflow-hidden">
          {/* Pagination Info and Items Per Page Selector */}
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="text-sm text-gray-700">
              <span>
                Showing <span className="font-semibold">{displayRange.start}</span> to{' '}
                <span className="font-semibold">{displayRange.end}</span> of{' '}
                <span className="font-semibold">{displayRange.total}</span> users
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="itemsPerPage" className="text-sm text-gray-700">
                Items per page:
              </label>
              <select
                id="itemsPerPage"
                value={limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF] text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Learner ID</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Parent Assessor</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Assigned Assessor</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500 text-sm">
                    {loading ? 'Loading users...' : 'No users found'}
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div>
                        <div className="text-xs font-medium text-gray-900">{user.name}</div>
                        <div className="text-[11px] text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role_name) ? (
                        user.learner_id ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 text-[11px] font-medium">
                            {user.learner_id}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Not set</span>
                        )
                      ) : (
                        <span className="text-gray-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex px-1.5 py-0.5 text-[11px] font-semibold rounded-full ${getRoleColor(user.role_name)}`}>
                        {user.role_name}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {user.manager_name ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[11px] font-medium">
                          {user.manager_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">No Manager</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {user.parent_tutor_name ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-medium">
                          {user.parent_tutor_name}
                        </span>
                      ) : user.role_name === 'Assessor' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[11px] font-medium">
                          Main Assessor
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {user.assigned_tutor_name ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-medium">
                          👨‍🏫 {user.assigned_tutor_name}
                        </span>
                      ) : user.role_name === 'Student' ? (
                        <span className="text-gray-400 italic">No Assessor</span>
                      ) : (
                        <span className="text-gray-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium">
                      <div className="flex flex-nowrap gap-1.5 items-center">
                        {currentUserRole === 'Admin' && (
                          <button
                            onClick={() => handleLoginAs(user)}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-pink-50 text-pink-700 border border-pink-200 hover:bg-pink-100 hover:border-pink-300 transition-colors"
                            title="Login as this user"
                          >
                            Login As
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setShowPassword(false);
                            setFormData({
                              name: user.name,
                              email: user.email,
                              learner_id: user.learner_id || '',
                              password: '',
                              role_id: user.role_id.toString(),
                              manager_id: user.manager_id?.toString() || '',
                              parent_tutor_id: user.parent_tutor_id?.toString() || '',
                              assigned_tutor_id: user.assigned_tutor_id?.toString() || ''
                            });
                          }}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 hover:border-cyan-300 transition-colors"
                        >
                          Edit
                        </button>
                        {!isImpersonating && (
                          <button
                            onClick={() => handleDeleteClick(user)}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-700">
              Page <span className="font-semibold">{page}</span> of{' '}
              <span className="font-semibold">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Previous Button */}
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  page > 1
                    ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'bg-gray-100 border border-gray-300 text-gray-400 cursor-not-allowed'
                }`}
              >
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {getPageNumbers().map((pageNum, index) => {
                  if (pageNum === '...') {
                    return (
                      <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                        ...
                      </span>
                    );
                  }
                  const pageNumber = pageNum as number;
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => handlePageChange(pageNumber)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        pageNumber === page
                          ? 'bg-[#11CCEF] text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>

              {/* Next Button */}
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  page < totalPages
                    ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'bg-gray-100 border border-gray-300 text-gray-400 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
        </div>
      )}
      </div>
      </div>

      {/* Create/Edit User Modal */}
      {(showCreateForm || editingUser) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-md md:max-w-xl lg:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
            {/* Header with gradient */}
            <div className="flex-shrink-0 bg-gradient-to-r from-[#11CCEF] via-[#11CCEF] to-[#E51791] px-4 lg:px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base lg:text-lg font-bold text-white">
                      {editingUser ? 'Edit User' : 'Create New User'}
                    </h3>
                    <p className="text-white/80 text-xs mt-0.5">
                      {editingUser ? 'Update user details' : 'Add a new user to the system'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingUser(null);
                    setFormData({ name: '', email: '', learner_id: '', password: '', role_id: '', manager_id: '', parent_tutor_id: '', assigned_tutor_id: '' });
                    setShowPassword(false);
                  }}
                  className="p-2 rounded-lg text-white/90 hover:bg-white/20 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6 bg-gradient-to-b from-gray-50/50 to-white">
              <div className="space-y-3 lg:space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Learner ID (Students only)
                </label>
                <input
                  type="text"
                  value={formData.learner_id}
                  onChange={(e) => setFormData({ ...formData, learner_id: e.target.value })}
                  disabled={!isStudentRoleSelected()}
                  placeholder={isStudentRoleSelected() ? 'Enter learner ID manually' : 'Only available for student roles'}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-500 transition-all"
                />
                {!isStudentRoleSelected() && (
                  <p className="mt-1 text-xs text-gray-400">Learner ID is only stored for Student, ManagerStudent, and InstituteStudent roles.</p>
                )}
              </div>
              {(!isImpersonating || !editingUser) && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {editingUser ? 'New password (leave blank to keep current)' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? 'Enter new password to change' : '••••••••'}
                    className="w-full px-3 py-2 text-sm pr-10 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#11CCEF] p-1 rounded-lg hover:bg-[#11CCEF]/10 transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Role</label>
                <select
                  required
                  value={formData.role_id}
                  onChange={(e) => {
                    const nextRoleId = e.target.value;
                    const nextRole = roles.find(role => role.id.toString() === nextRoleId);
                    const isStudentRole = !!nextRole && ['Student', 'ManagerStudent', 'InstituteStudent'].includes(nextRole.name);
                    setFormData({
                      ...formData,
                      role_id: nextRoleId,
                      learner_id: isStudentRole ? formData.learner_id : '',
                      assigned_tutor_id: isStudentRole ? formData.assigned_tutor_id : ''
                    });
                  }}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white"
                >
                  <option value="">Select Role</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Manager (Optional)</label>
                <select
                  value={formData.manager_id}
                  onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] transition-all bg-white"
                >
                  <option value="">No Manager</option>
                  {managers.map(manager => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} ({manager.email})
                    </option>
                  ))}
                </select>
                {managers.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">No managers available. Create a Manager user first.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Parent Assessor (Optional) - For Sub-Assessors Only
                </label>
                <select
                  value={formData.parent_tutor_id}
                  onChange={(e) => setFormData({ ...formData, parent_tutor_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] disabled:bg-gray-100 disabled:border-gray-200 transition-all bg-white"
                  disabled={formData.role_id !== '2'} // Only enable for Assessor role
                >
                  <option value="">No Parent Assessor (Main Assessor)</option>
                  {tutors.filter(t => !t.parent_tutor_id).map(tutor => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.name} ({tutor.email})
                    </option>
                  ))}
                </select>
                {formData.role_id === '2' && tutors.filter(t => !t.parent_tutor_id).length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">No main assessors available. Create a main assessor first.</p>
                )}
                {formData.role_id !== '2' && (
                  <p className="mt-1 text-xs text-gray-400">Only available for Assessor role</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assigned Assessor (Optional) - For Students Only
                </label>
                <select
                  value={formData.assigned_tutor_id}
                  onChange={(e) => setFormData({ ...formData, assigned_tutor_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]/30 focus:border-[#11CCEF] disabled:bg-gray-100 disabled:border-gray-200 transition-all bg-white"
                  disabled={!isStudentRoleSelected()}
                >
                  <option value="">No Assessor Assigned</option>
                  {tutors.map(tutor => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.name} {tutor.parent_tutor_name ? `(Sub - under ${tutor.parent_tutor_name})` : '(Main Assessor)'}
                    </option>
                  ))}
                </select>
                {isStudentRoleSelected() && tutors.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">No assessors available. Create an Assessor user first.</p>
                )}
                {!isStudentRoleSelected() && (
                  <p className="mt-1 text-xs text-gray-400">Only available for student roles</p>
                )}
              </div>
              </div>
            </div>
            </div>
              <div className="flex-shrink-0 flex justify-end gap-3 p-4 border-t border-gray-200 bg-white rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingUser(null);
                    setFormData({ name: '', email: '', learner_id: '', password: '', role_id: '', manager_id: '', parent_tutor_id: '', assigned_tutor_id: '' });
                    setShowPassword(false);
                  }}
                  className="px-4 py-2 text-sm text-gray-700 font-semibold bg-gray-100 rounded-lg hover:bg-gray-200 border border-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[#11CCEF]/30 transition-all"
                >
                  {editingUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Error Modal */}
      {deleteError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Cannot Delete User</h3>
                <p className="text-sm text-gray-700 mb-4">{deleteError}</p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-yellow-800">
                    <strong>What to do:</strong>
                  </p>
                  <ul className="text-xs text-yellow-700 mt-1 list-disc list-inside space-y-1">
                    {deleteError.includes('manager') && (
                      <>
                        <li>Go to User Management and find the students assigned to this manager</li>
                        <li>Edit those students and assign them to a different manager or remove their manager assignment</li>
                        <li>Then try deleting this user again</li>
                      </>
                    )}
                    {!deleteError.includes('manager') && (
                      <>
                        <li>Check if this user has any related records in the system</li>
                        <li>Remove or reassign those records first</li>
                        <li>Then try deleting this user again</li>
                      </>
                    )}
                  </ul>
                </div>
                <button
                  onClick={() => setDeleteError(null)}
                  className="w-full px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] transition-colors"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Delete User</h3>
                <p className="text-sm text-gray-600 mt-1">This action cannot be undone.</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{userToDelete.name}</span>?
              </p>
              <p className="text-sm text-gray-500">
                Email: <span className="font-mono">{userToDelete.email}</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Role: <span className="font-medium">{userToDelete.role_name}</span>
              </p>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{deleteError}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete User</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Success Message */}
      {deleteSuccess && (
        <div 
          className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg z-50 flex items-center gap-3"
          style={{
            animation: 'fadeInSlide 0.3s ease-out'
          }}
        >
          <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-green-800">User deleted successfully!</p>
        </div>
      )}

      {/* Animation styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInSlide {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}} />
    </div>
  );
};

export default UserManagement;
