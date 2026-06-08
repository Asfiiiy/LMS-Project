'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';
import { showToast } from '@/app/components/Toast';
import Swal from 'sweetalert2';

interface AIToken {
  id: number;
  token: string;
  name: string;
  description: string | null;
  created_by: number;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  is_revoked: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  usage_count: number;
  rate_limit_per_minute: number;
  unique_ip_count: number;
  security_alert_count: number;
  last_security_alert_at: string | null;
  permissions: string[];
}

const AITokenManagement = () => {
  const [tokens, setTokens] = useState<AIToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedToken, setSelectedToken] = useState<AIToken | null>(null);
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [tokenLogs, setTokenLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [securityData, setSecurityData] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'revoked'>('all');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    expiresAt: '',
    permissions: [] as string[],
    rateLimit: 60
  });

  const availablePermissions = [
    // User Management (Original)
    { value: 'users.create', label: 'Create Users', group: 'User Management' },
    { value: 'users.assign_tutor', label: 'Assign Tutors', group: 'User Management' },
    
    // Enrollment Management (Original)
    { value: 'enrollments.read', label: 'Read Enrollments', group: 'Enrollment Management' },
    { value: 'enrollments.create', label: 'Create Enrollments', group: 'Enrollment Management' },
    { value: 'enrollments.setup', label: 'Setup Enrollments', group: 'Enrollment Management' },
    
    // Student Profile & Onboarding
    { value: 'students.profile.read', label: 'Read Student Profiles', group: 'Student Profile' },
    { value: 'students.profile.update', label: 'Update Student Profiles', group: 'Student Profile' },
    { value: 'students.onboarding.read', label: 'Read Onboarding Data', group: 'Student Profile' },
    { value: 'students.onboarding.verify', label: 'Verify Onboarding', group: 'Student Profile' },
    { value: 'students.onboarding.status', label: 'Check Onboarding Status (new/review/verified)', group: 'Student Profile' },
    
    // Document Management
    { value: 'students.documents.read', label: 'Read Documents', group: 'Student Profile' },
    { value: 'students.documents.approve', label: 'Approve Documents', group: 'Student Profile' },
    { value: 'students.documents.reject', label: 'Reject Documents', group: 'Student Profile' }
  ];

  const permissionGroups = {
    'AI Onboarding Reviewer': [
      'students.profile.read',
      'students.onboarding.read',
      'students.onboarding.status',
      'students.onboarding.verify',
      'students.documents.read',
      'students.documents.approve',
      'students.documents.reject'
    ],
    'AI Student Manager': [
      'students.profile.read',
      'students.profile.update',
      'students.onboarding.read',
      'students.onboarding.status',
      'enrollments.read'
    ],
    'AI Enrollment Manager': [
      'users.create',
      'users.assign_tutor',
      'students.profile.read',
      'enrollments.read',
      'enrollments.create',
      'enrollments.setup'
    ],
    'Read Only Access': [
      'enrollments.read',
      'students.profile.read',
      'students.onboarding.status'
    ]
  };

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const toggleSelectAll = () => {
    const allPermissionValues = availablePermissions.map(p => p.value);
    if (formData.permissions.length === allPermissionValues.length) {
      // Deselect all
      setFormData(prev => ({ ...prev, permissions: [] }));
    } else {
      // Select all
      setFormData(prev => ({ ...prev, permissions: allPermissionValues }));
    }
  };

  const applyPermissionGroup = (groupName: string) => {
    const permissions = permissionGroups[groupName as keyof typeof permissionGroups];
    if (permissions) {
      setFormData(prev => ({
        ...prev,
        permissions: [...permissions]
      }));
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [filter]);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (filter === 'active') {
        filters.isActive = true;
        filters.isRevoked = false;
      } else if (filter === 'revoked') {
        filters.isRevoked = true;
      }

      const response = await apiService.getAITokens(filters);
      if (response.success) {
        setTokens(response.tokens || []);
      } else {
        showToast('Error fetching tokens', 'error');
      }
    } catch (error) {
      showToast('Error fetching tokens', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        expiresAt: formData.expiresAt || undefined,
        permissions: formData.permissions,
        rateLimit: formData.rateLimit
      };

      const response = await apiService.createAIToken(data);
      if (response.success) {
        showToast('AI token created successfully!', 'success');
        setShowCreateForm(false);
        setFormData({
          name: '',
          description: '',
          expiresAt: '',
          permissions: [],
          rateLimit: 60
        });
        fetchTokens();
        
        // Show the token in SweetAlert with copy functionality
        if (response.token) {
          const tokenValue = response.token.token;
          
          Swal.fire({
            title: 'Token Created Successfully!',
            html: `
              <div style="text-align: left;">
                <p style="margin-bottom: 15px; color: #666;">
                  Please copy this token now. <strong>It won't be shown again!</strong>
                </p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 15px; position: relative; border: 1px solid #e5e7eb;">
                  <code id="token-value" style="font-size: 13px; word-break: break-all; color: #333; display: block; font-family: 'Courier New', monospace;">
                    ${tokenValue}
                  </code>
                </div>
                <button 
                  id="copy-token-btn" 
                  style="width: 100%; padding: 12px; background: #11CCEF; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; margin-top: 10px; transition: background 0.3s;"
                >
                  📋 Copy Token
                </button>
              </div>
            `,
            icon: 'success',
            confirmButtonText: 'Done',
            confirmButtonColor: '#11CCEF',
            width: '600px',
            allowOutsideClick: false,
            didOpen: () => {
              // Add click handler for copy button
              const copyBtn = document.getElementById('copy-token-btn');
              if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                  try {
                    await navigator.clipboard.writeText(tokenValue);
                    const btn = document.getElementById('copy-token-btn');
                    if (btn) {
                      const originalText = btn.innerHTML;
                      btn.innerHTML = '✓ Copied!';
                      btn.style.background = '#10b981';
                      setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.background = '#11CCEF';
                      }, 2000);
                    }
                    // Also show a small toast
                    showToast('Token copied to clipboard!', 'success');
                  } catch (err) {
                    // Fallback: select text
                    const tokenElement = document.getElementById('token-value');
                    if (tokenElement) {
                      const range = document.createRange();
                      range.selectNodeContents(tokenElement);
                      const selection = window.getSelection();
                      selection?.removeAllRanges();
                      selection?.addRange(range);
                      showToast('Text selected. Press Ctrl+C to copy', 'info');
                    } else {
                      showToast('Failed to copy token', 'error');
                    }
                  }
                });
              }
            }
          });
        }
      } else {
        showToast(response.message || 'Error creating token', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Error creating token', 'error');
    }
  };

  const handleRevokeToken = async (tokenId: number, reason?: string) => {
    const result = await Swal.fire({
      title: 'Revoke Token?',
      text: 'Are you sure you want to revoke this token? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, revoke it',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      focusCancel: true
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await apiService.revokeAIToken(tokenId, reason);
      if (response.success) {
        Swal.fire({
          title: 'Token Revoked!',
          text: 'The token has been successfully revoked.',
          icon: 'success',
          confirmButtonColor: '#11CCEF',
          confirmButtonText: 'OK'
        });
        fetchTokens();
        if (selectedToken?.id === tokenId) {
          setSelectedToken(null);
          setShowTokenDetails(false);
        }
      } else {
        Swal.fire({
          title: 'Error',
          text: response.message || 'Error revoking token',
          icon: 'error',
          confirmButtonColor: '#11CCEF',
          confirmButtonText: 'OK'
        });
      }
    } catch (error: any) {
      Swal.fire({
        title: 'Error',
        text: error.message || 'Error revoking token',
        icon: 'error',
        confirmButtonColor: '#11CCEF',
        confirmButtonText: 'OK'
      });
    }
  };

  const handleDeleteToken = async (tokenId: number, tokenName: string) => {
    const result = await Swal.fire({
      title: 'Delete Token?',
      html: `
        <div style="text-align: left;">
          <p style="margin-bottom: 10px;">Are you sure you want to delete <strong>${tokenName}</strong>?</p>
          <p style="color: #dc2626; font-weight: 600;">This action cannot be undone and will permanently delete:</p>
          <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
            <li>The token</li>
            <li>All associated logs</li>
            <li>All IP tracking data</li>
          </ul>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      focusCancel: true
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await apiService.deleteAIToken(tokenId);
      if (response.success) {
        Swal.fire({
          title: 'Token Deleted!',
          text: 'The token has been permanently deleted.',
          icon: 'success',
          confirmButtonColor: '#11CCEF',
          confirmButtonText: 'OK'
        });
        fetchTokens();
        if (selectedToken?.id === tokenId) {
          setSelectedToken(null);
          setShowTokenDetails(false);
          setShowSecurityDetails(false);
        }
      } else {
        Swal.fire({
          title: 'Error',
          text: response.message || 'Error deleting token',
          icon: 'error',
          confirmButtonColor: '#11CCEF',
          confirmButtonText: 'OK'
        });
      }
    } catch (error: any) {
      Swal.fire({
        title: 'Error',
        text: error.message || 'Error deleting token',
        icon: 'error',
        confirmButtonColor: '#11CCEF',
        confirmButtonText: 'OK'
      });
    }
  };

  const handleViewSecurity = async (token: AIToken) => {
    try {
      const response = await apiService.getAITokenSecurity(token.id);
      if (response.success) {
        setSecurityData(response);
        setSelectedToken(token);
        setShowSecurityDetails(true);
      } else {
        showToast('Error fetching security data', 'error');
      }
    } catch (error) {
      showToast('Error fetching security data', 'error');
    }
  };

  const handleViewLogs = async (token: AIToken, page: number = 1) => {
    try {
      setLogsLoading(true);
      setSelectedToken(token);
      
      const response = await fetch(`/api/admin/ai-tokens/${token.id}/logs?page=${page}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setTokenLogs(data.logs || []);
        setLogsTotalPages(data.pagination?.totalPages || 1);
        setLogsPage(page);
        setShowLogsModal(true);
      } else {
        showToast('Error fetching logs', 'error');
      }
    } catch (error) {
      showToast('Error fetching logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const filteredTokens = tokens.filter(token => {
    if (filter === 'active') {
      return token.is_active && !token.is_revoked && !isExpired(token.expires_at);
    } else if (filter === 'revoked') {
      return token.is_revoked;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Token Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage AI automation tokens for automated tasks
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <span>+</span> Create New Token
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Tokens
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'active'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('revoked')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'revoked'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Revoked
        </button>
      </div>

      {/* Create Token Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create New AI Token</h3>
            <form onSubmit={handleCreateToken} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Token Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                  placeholder="e.g., Jarvis AI, AutoBot"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Optional description of what this token is used for"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for no expiration
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permission Templates
                </label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {Object.keys(permissionGroups).map(groupName => (
                    <button
                      key={groupName}
                      type="button"
                      onClick={() => applyPermissionGroup(groupName)}
                      className="px-3 py-2 text-sm bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] transition-colors"
                    >
                      {groupName}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permissions * ({formData.permissions.length} of {availablePermissions.length} selected)
                </label>
                
                {/* Select All Checkbox */}
                <div className="mb-4 p-4 bg-gradient-to-r from-[#11CCEF]/10 to-[#E51791]/10 border-2 border-[#11CCEF]/30 rounded-xl">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permissions.length === availablePermissions.length}
                      onChange={toggleSelectAll}
                      className="w-5 h-5 rounded border-gray-300 text-[#11CCEF] focus:ring-[#11CCEF]"
                    />
                    <span className="font-bold text-gray-900">
                      Select All Permissions
                    </span>
                  </label>
                </div>

                <div className="border-2 border-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto">
                  {/* Group permissions by category */}
                  {['User Management', 'Enrollment Management', 'Student Profile'].map(group => {
                    const groupPerms = availablePermissions.filter(p => p.group === group);
                    if (groupPerms.length === 0) return null;
                    
                    return (
                      <div key={group} className="mb-4 last:mb-0">
                        <div className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-[#11CCEF]"></span>
                          {group}
                        </div>
                        <div className="space-y-1.5 ml-4">
                          {groupPerms.map(permission => (
                            <label key={permission.value} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(permission.value)}
                                onChange={() => togglePermission(permission.value)}
                                className="mt-0.5 rounded border-gray-300 text-[#11CCEF] focus:ring-[#11CCEF]"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">{permission.label}</div>
                                <div className="text-xs text-gray-500">{permission.value}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate Limit (requests per minute)
                </label>
                <input
                  type="number"
                  value={formData.rateLimit}
                  onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) || 60 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="1"
                  max="1000"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security Details Modal */}
      {showSecurityDetails && selectedToken && securityData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Security Details: {selectedToken.name}</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Security Summary</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Unique IP Addresses:</span>
                    <span className="font-semibold">{securityData.token.unique_ip_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Security Alerts:</span>
                    <span className={`font-semibold ${securityData.token.security_alert_count > 0 ? 'text-red-600' : ''}`}>
                      {securityData.token.security_alert_count}
                    </span>
                  </div>
                  {securityData.token.last_security_alert_at && (
                    <div className="flex justify-between">
                      <span>Last Alert:</span>
                      <span>{formatDate(securityData.token.last_security_alert_at)}</span>
                    </div>
                  )}
                  {securityData.token.is_revoked && (
                    <div className="flex justify-between">
                      <span>Revoked:</span>
                      <span className="text-red-600 font-semibold">Yes</span>
                    </div>
                  )}
                  {securityData.token.revoked_reason && (
                    <div>
                      <span className="font-semibold">Reason:</span>
                      <p className="text-sm text-gray-600 mt-1">{securityData.token.revoked_reason}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">IP Address Tracking</h4>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">IP Address</th>
                        <th className="px-4 py-2 text-left">Country</th>
                        <th className="px-4 py-2 text-left">First Used</th>
                        <th className="px-4 py-2 text-left">Last Used</th>
                        <th className="px-4 py-2 text-left">Usage Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {securityData.ipTracking.map((ip: any, index: number) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-2">{ip.ip_address}</td>
                          <td className="px-4 py-2">{ip.country_name || ip.country_code || 'Unknown'}</td>
                          <td className="px-4 py-2">{formatDate(ip.first_used_at)}</td>
                          <td className="px-4 py-2">{formatDate(ip.last_used_at)}</td>
                          <td className="px-4 py-2">{ip.usage_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowSecurityDetails(false);
                  setSecurityData(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tokens List */}
      {loading ? (
        <div className="text-center py-8">Loading tokens...</div>
      ) : filteredTokens.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No tokens found</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Usage</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Last Used</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Security</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTokens.map((token) => (
                <tr key={token.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900">{token.name}</div>
                      {token.description && (
                        <div className="text-sm text-gray-500">{token.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {token.is_revoked ? (
                        <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                          Revoked
                        </span>
                      ) : isExpired(token.expires_at) ? (
                        <span className="inline-block px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                          Expired
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          Active
                        </span>
                      )}
                      {token.expires_at && (
                        <div className="text-xs text-gray-500">
                          Expires: {formatDate(token.expires_at)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {token.usage_count} requests
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(token.last_used_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {token.security_alert_count > 0 && (
                        <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                          ⚠️ {token.security_alert_count} alert(s)
                        </span>
                      )}
                      <div className="text-xs text-gray-500">
                        {token.unique_ip_count} IP(s)
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleViewLogs(token)}
                        className="px-3 py-1 text-sm bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded hover:opacity-90 transition-opacity"
                        title="View activity logs"
                      >
                        📊 Logs
                      </button>
                      <button
                        onClick={() => handleViewSecurity(token)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Security
                      </button>
                      {!token.is_revoked && (
                        <button
                          onClick={() => handleRevokeToken(token.id)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteToken(token.id, token.name)}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        title="Delete token permanently"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Logs Modal */}
      {showLogsModal && selectedToken && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#11CCEF] via-[#E51791] to-[#11CCEF] p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                    📊 Activity Logs
                  </h3>
                  <p className="text-white/90 text-sm mt-1">
                    {selectedToken.name} - All AI actions and operations
                  </p>
                </div>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {logsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF]"></div>
                </div>
              ) : tokenLogs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-gray-500 text-lg">No activity logs yet</p>
                  <p className="text-gray-400 text-sm mt-2">Logs will appear here when this token is used</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tokenLogs.map((log: any, index: number) => (
                    <div
                      key={log.id}
                      className={`bg-white rounded-xl shadow border-2 p-5 hover:shadow-lg transition-shadow ${
                        log.response_status >= 400
                          ? 'border-red-200 bg-red-50/30'
                          : log.response_status >= 200 && log.response_status < 300
                          ? 'border-green-200 bg-green-50/30'
                          : 'border-gray-200'
                      }`}
                    >
                      {/* Log Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {/* Status Badge */}
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                log.response_status >= 400
                                  ? 'bg-red-500 text-white'
                                  : log.response_status >= 200 && log.response_status < 300
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-500 text-white'
                              }`}
                            >
                              {log.response_status || 'N/A'}
                            </span>

                            {/* Action Type */}
                            <span className="px-3 py-1 bg-gradient-to-r from-[#11CCEF]/20 to-[#E51791]/20 text-gray-800 rounded-full text-xs font-semibold">
                              {log.action_type}
                            </span>

                            {/* Method */}
                            <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                              log.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                              log.method === 'POST' ? 'bg-green-100 text-green-700' :
                              log.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                              log.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {log.method}
                            </span>
                          </div>

                          {/* Action Description */}
                          <p className="text-gray-900 font-medium">{log.action_description}</p>

                          {/* Endpoint */}
                          <p className="text-sm font-mono text-gray-600 mt-1 break-all">
                            {log.endpoint}
                          </p>
                        </div>

                        {/* Time Info */}
                        <div className="text-right ml-4">
                          <p className="text-xs text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                          {log.response_time_ms && (
                            <p className="text-xs text-gray-400 mt-1">
                              {log.response_time_ms}ms
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-200">
                        {/* IP Address & Location */}
                        {log.ip_address && (
                          <div>
                            <p className="text-xs text-gray-500">IP Address</p>
                            <p className="text-sm font-mono text-gray-900">{log.ip_address}</p>
                            {log.country_name && (
                              <p className="text-xs text-gray-600">
                                {log.country_code} {log.country_name}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Affected Entities */}
                        {(log.affected_user_id || log.affected_student_id || log.affected_course_id || log.affected_enrollment_id) && (
                          <div>
                            <p className="text-xs text-gray-500">Affected Entities</p>
                            <div className="text-sm text-gray-900 space-y-0.5">
                              {log.affected_user_id && <p>User #{log.affected_user_id}</p>}
                              {log.affected_student_id && <p>Student #{log.affected_student_id}</p>}
                              {log.affected_course_id && <p>Course #{log.affected_course_id}</p>}
                              {log.affected_enrollment_id && <p>Enrollment #{log.affected_enrollment_id}</p>}
                            </div>
                          </div>
                        )}

                        {/* User Agent (truncated) */}
                        {log.user_agent && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">User Agent</p>
                            <p className="text-xs text-gray-700 truncate" title={log.user_agent}>
                              {log.user_agent}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Error Message */}
                      {log.error_message && (
                        <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg">
                          <p className="text-xs text-red-700 font-semibold mb-1">Error:</p>
                          <p className="text-sm text-red-800">{log.error_message}</p>
                        </div>
                      )}

                      {/* Expandable Request/Response (optional enhancement) */}
                      {(log.request_body || log.response_body) && (
                        <details className="mt-3">
                          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                            View Request/Response Data
                          </summary>
                          <div className="mt-2 space-y-2">
                            {log.request_body && (
                              <div>
                                <p className="text-xs font-semibold text-gray-700">Request:</p>
                                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-32">
                                  {log.request_body}
                                </pre>
                              </div>
                            )}
                            {log.response_body && (
                              <div>
                                <p className="text-xs font-semibold text-gray-700">Response:</p>
                                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-32">
                                  {log.response_body}
                                </pre>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {!logsLoading && tokenLogs.length > 0 && logsTotalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => handleViewLogs(selectedToken, logsPage - 1)}
                    disabled={logsPage === 1}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {logsPage} of {logsTotalPages}
                  </span>
                  <button
                    onClick={() => handleViewLogs(selectedToken, logsPage + 1)}
                    disabled={logsPage === logsTotalPages}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t border-gray-200">
              <p className="text-sm text-gray-600">
                {tokenLogs.length > 0 ? `Showing ${tokenLogs.length} logs` : 'No logs to display'}
              </p>
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-6 py-2 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AITokenManagement;
