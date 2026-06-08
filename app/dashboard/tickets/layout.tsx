'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { User, UserRole } from '@/app/components/types';
import { getApiUrl } from '@/app/utils/apiUrl';
import Link from 'next/link';
import { 
  FiHome, 
  FiMessageCircle, 
  FiUsers, 
  FiUser,
  FiBookOpen, 
  FiChevronLeft, 
  FiChevronRight,
  FiLogOut,
  FiMenu,
  FiX
} from 'react-icons/fi';

const TICKET_ACCESS_ROLES: UserRole[] = [
  'Admin', 'Operation Manager', 'Accounts Manager', 'Administrative Manager',
  'Admission Manager', 'Assessor', 'Team Member', 'Manager', 'Moderator', 'Certificate Manager'
];

function TicketsLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [departments, setDepartments] = useState<{ id: number; name: string; color: string }[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const u: User | null = JSON.parse(localStorage.getItem('lms-user') || 'null');
    setUser(u);
    if (!u) { router.push('/login'); return; }
    const role = u.role as UserRole;
    const studentRoles = ['Student', 'ManagerStudent', 'InstituteStudent'];
    if (!TICKET_ACCESS_ROLES.includes(role) && !studentRoles.includes(role || '')) {
      router.push(role === 'Admin' ? '/dashboard/admin' : role === 'Manager' ? '/dashboard/manager' : '/dashboard/student');
      return;
    }
    fetchDepartments();

    // Load sidebar state from localStorage
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState) {
      setIsSidebarCollapsed(savedState === 'true');
    }
  }, [router]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/tickets/departments`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('lms-token')}` }
      });
      const data = await res.json();
      if (data.success) setDepartments(data.departments || []);
    } catch (e) { }
  };

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  const handleLogout = () => {
    localStorage.removeItem('lms-user');
    localStorage.removeItem('lms-token');
    router.push('/login');
  };

  if (!user) return null;

  const role = user.role as UserRole;
  const fromCertManager = searchParams.get('from') === 'certificate-manager' && role === 'Certificate Manager';
  const isStudent = ['Student', 'ManagerStudent', 'InstituteStudent'].includes(role || '');
  const isOperationManager = role === 'Operation Manager';

  // Get user initials for avatar
  const userInitials = (user?.name || 'User')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <ProtectedRoute allowedRoles={[...TICKET_ACCESS_ROLES, 'Student', 'ManagerStudent', 'InstituteStudent']} userRole={role}>
      <div className="flex min-h-screen bg-gray-50">
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        {!isStudent && (
          <aside 
            className={`fixed lg:static inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out bg-white border-r border-gray-200 flex-shrink-0 ${
              isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            } ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}
          >
            {/* Sidebar Header */}
            <div className={`h-16 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} px-4 border-b border-gray-200 bg-gradient-to-r from-[#11CCEF]/5 to-[#E51791]/5`}>
              {!isSidebarCollapsed && (
                <Link href={fromCertManager ? '/dashboard/certificate-manager' : '/dashboard'} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#11CCEF] to-[#E51791] flex items-center justify-center text-white font-bold text-lg">
                    {fromCertManager ? '🏆' : 'T'}
                  </div>
                  <span className="font-bold text-gray-800">{fromCertManager ? 'Certificate' : 'TicketFlow'}</span>
                </Link>
              )}
              {isSidebarCollapsed && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#11CCEF] to-[#E51791] flex items-center justify-center text-white font-bold text-lg">
                  {fromCertManager ? '🏆' : 'T'}
                </div>
              )}
            </div>

            {/* Toggle Button - Desktop */}
            <button
              onClick={toggleSidebar}
              className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full items-center justify-center text-gray-500 hover:text-[#11CCEF] hover:border-[#11CCEF] transition-colors shadow-sm z-10"
            >
              {isSidebarCollapsed ? <FiChevronRight className="w-4 h-4" /> : <FiChevronLeft className="w-4 h-4" />}
            </button>

            {/* Close Button - Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <FiX className="w-5 h-5" />
            </button>

            {/* Navigation */}
            <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-4rem)]">
              {fromCertManager ? (
                /* Certificate Manager Navigation */
                <>
                  <div className="space-y-1">
                    <Link 
                      href="/dashboard/certificate-manager" 
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all group"
                      title={isSidebarCollapsed ? 'Ticket Dashboard' : ''}
                    >
                      <span className="text-lg">🎫</span>
                      {!isSidebarCollapsed && <span>Ticket Dashboard</span>}
                    </Link>
                    <Link 
                      href="/dashboard/tickets/chat?from=certificate-manager" 
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                        pathname === '/dashboard/tickets/chat' 
                          ? 'bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 text-[#11CCEF]' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={isSidebarCollapsed ? 'Chat' : ''}
                    >
                      <span className="text-lg">💬</span>
                      {!isSidebarCollapsed && <span>Chat</span>}
                    </Link>
                  </div>
                  <div className="my-4 border-t border-gray-200" />
                  {!isSidebarCollapsed && (
                    <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Certificate</p>
                  )}
                  <div className="space-y-1">
                    {[
                      { id: 'certificates', name: 'Certificates', icon: '🏆' },
                      { id: 'payments', name: 'Payments', icon: '💳' },
                      { id: 'students-profile', name: 'Students Profile', icon: '👤' },
                      { id: 'certificate-templates', name: 'Certificate Templates', icon: '📄' },
                      { id: 'generated-certificates', name: 'Generated Certificates', icon: '📜' },
                    ].map((tab) => (
                      <Link
                        key={tab.id}
                        href="/dashboard/certificate-manager"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all group"
                        title={isSidebarCollapsed ? tab.name : ''}
                      >
                        <span className="text-lg">{tab.icon}</span>
                        {!isSidebarCollapsed && <span>{tab.name}</span>}
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <>
              {/* Main Navigation */}
              <div className="space-y-1">
                <Link 
                  href="/dashboard/tickets" 
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    pathname === '/dashboard/tickets' 
                      ? 'bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 text-[#11CCEF]' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={isSidebarCollapsed ? 'Dashboard' : ''}
                >
                  <FiHome className={`w-5 h-5 ${pathname === '/dashboard/tickets' ? 'text-[#11CCEF]' : 'text-gray-500 group-hover:text-[#11CCEF]'}`} />
                  {!isSidebarCollapsed && <span>Dashboard</span>}
                </Link>

                <Link 
                  href="/dashboard/tickets/chat" 
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    pathname === '/dashboard/tickets/chat' 
                      ? 'bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 text-[#11CCEF]' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={isSidebarCollapsed ? 'Chat' : ''}
                >
                  <FiMessageCircle className={`w-5 h-5 ${pathname === '/dashboard/tickets/chat' ? 'text-[#11CCEF]' : 'text-gray-500 group-hover:text-[#11CCEF]'}`} />
                  {!isSidebarCollapsed && <span>Chat</span>}
                </Link>

                {isOperationManager && (
                  <Link
                    href="/dashboard/operation-manager/consultations"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      pathname?.startsWith('/dashboard/operation-manager/consultations')
                        ? 'bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 text-[#11CCEF]'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Consultations — Manage consultation slots' : ''}
                  >
                    <span className="text-lg">📹</span>
                    {!isSidebarCollapsed && <span>Consultations</span>}
                  </Link>
                )}

                {isOperationManager && (
                  <Link
                    href="/dashboard/tickets/students-profile"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      pathname === '/dashboard/tickets/students-profile'
                        ? 'bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 text-[#11CCEF]'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Students Profile' : ''}
                  >
                    <span className="text-lg">👤</span>
                    {!isSidebarCollapsed && <span>Students Profile</span>}
                  </Link>
                )}

                {(role === 'Operation Manager' || role === 'Accounts Manager' || role === 'Administrative Manager' || role === 'Admission Manager' || role === 'Team Member') && (
                  <Link 
                    href="/dashboard/tickets/payments" 
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      pathname === '/dashboard/tickets/payments' 
                        ? 'bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 text-[#11CCEF]' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Payments' : ''}
                  >
                    <span className="text-lg">💳</span>
                    {!isSidebarCollapsed && <span>Payments</span>}
                  </Link>
                )}

                {(role === 'Operation Manager' || role === 'Accounts Manager' || role === 'Administrative Manager' || role === 'Admission Manager') && (
                  <Link 
                    href="/dashboard/tickets/team" 
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      pathname === '/dashboard/tickets/team' 
                        ? 'bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 text-[#11CCEF]' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'My Team' : ''}
                  >
                    <FiUsers className={`w-5 h-5 ${pathname === '/dashboard/tickets/team' ? 'text-[#11CCEF]' : 'text-gray-500 group-hover:text-[#11CCEF]'}`} />
                    {!isSidebarCollapsed && <span>My Team</span>}
                  </Link>
                )}

                {role === 'Accounts Manager' && (
                  <>
                    <Link
                      href="/dashboard/tickets/students"
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                        pathname === '/dashboard/tickets/students'
                          ? 'bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 text-[#11CCEF]'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={isSidebarCollapsed ? 'Students' : ''}
                    >
                      <FiUser
                        className={`w-5 h-5 ${pathname === '/dashboard/tickets/students' ? 'text-[#11CCEF]' : 'text-gray-500 group-hover:text-[#11CCEF]'}`}
                      />
                      {!isSidebarCollapsed && <span>Students</span>}
                    </Link>
                    <Link
                      href="/dashboard/tickets/students-profile"
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                        pathname === '/dashboard/tickets/students-profile'
                          ? 'bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 text-[#11CCEF]'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={isSidebarCollapsed ? 'Students Profile' : ''}
                    >
                      <span className="text-lg">👤</span>
                      {!isSidebarCollapsed && <span>Students Profile</span>}
                    </Link>
                  </>
                )}

                {(role === 'Operation Manager' || role === 'Team Member') && (
                  <Link 
                    href="/dashboard/tickets/courses" 
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      pathname?.startsWith('/dashboard/tickets/courses') 
                        ? 'bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 text-[#11CCEF]' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    title={isSidebarCollapsed ? 'Total Courses' : ''}
                  >
                    <FiBookOpen className={`w-5 h-5 ${pathname?.startsWith('/dashboard/tickets/courses') ? 'text-[#11CCEF]' : 'text-gray-500 group-hover:text-[#11CCEF]'}`} />
                    {!isSidebarCollapsed && <span>Total Courses</span>}
                  </Link>
                )}
              </div>

              {/* Divider */}
              {departments.length > 0 && (
                <>
                  <div className="my-4 border-t border-gray-200" />
                  {!isSidebarCollapsed && (
                    <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Departments
                    </p>
                  )}
                  
                  {/* Department Links */}
                  <div className="space-y-1">
                    {departments.map((d) => (
                      <Link 
                        key={d.id} 
                        href={`/dashboard/tickets?department=${d.id}`} 
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all group relative"
                        title={isSidebarCollapsed ? d.name : ''}
                      >
                        {!isSidebarCollapsed && (
                          <div 
                            className="absolute left-0 w-1 h-6 rounded-r-full" 
                            style={{ backgroundColor: d.color }}
                          />
                        )}
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: d.color }}
                        />
                        {!isSidebarCollapsed && <span>{d.name}</span>}
                      </Link>
                    ))}
                  </div>
                </>
              )}
              </>
              )}

              <div className="absolute bottom-4 left-0 right-0 px-4 space-y-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all group"
                  title={isSidebarCollapsed ? 'Logout' : ''}
                >
                  <FiLogOut className="w-5 h-5" />
                  {!isSidebarCollapsed && <span>Logout</span>}
                </button>
              </div>
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div className="flex items-center justify-between px-4 lg:px-6 py-3">
              <div className="flex items-center gap-3">
                {/* Mobile Menu Button */}
                {!isStudent && (
                  <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="lg:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                  >
                    <FiMenu className="w-5 h-5" />
                  </button>
                )}
                
                {/* Breadcrumb or Page Title can go here */}
                <h2 className="text-lg font-semibold text-gray-800">
                  {fromCertManager
                    ? pathname === '/dashboard/tickets/chat' ? 'Chat' : /\/dashboard\/tickets\/\d+/.test(pathname || '') ? 'Ticket' : 'Ticket Dashboard'
                    : pathname === '/dashboard/tickets' ? 'Ticket Dashboard' : pathname === '/dashboard/tickets/students' ? 'Students' : pathname === '/dashboard/tickets/students-profile' ? 'Students Profile' : pathname === '/dashboard/tickets/payments' ? 'Payments' : pathname === '/dashboard/tickets/chat' ? 'Chat' : /\/dashboard\/tickets\/\d+/.test(pathname || '') ? 'Ticket' : ''}
                </h2>
              </div>

              {/* Right side icons */}
              <div className="flex items-center gap-3">
                {/* User Profile */}
                <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#11CCEF] to-[#E51791] flex items-center justify-center text-white font-semibold text-sm">
                    {userInitials}
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-sm font-medium text-gray-900">{user?.name ?? 'User'}</p>
                    <p className="text-xs text-gray-500">{user?.role ?? ''}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-gray-50"><main className="flex-1 overflow-auto"><div className="p-4 lg:p-6">{children}</div></main></div>}>
      <TicketsLayoutContent>{children}</TicketsLayoutContent>
    </Suspense>
  );
}