'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { UserRole } from '@/app/components/types';

interface ProfileData {
  gender?: string;
  date_of_birth?: string;
  nationality?: string;
  ethnicity?: string;
  current_role?: string;
  previous_qualification?: string;
  motivation?: string;
  vark_visual?: number;
  vark_auditory?: number;
  vark_reading?: number;
  vark_kinesthetic?: number;
  english_literacy?: string;
  ict_skills?: string;
  special_learning_needs?: string;
}

interface CompletionData {
  is_complete: boolean;
  completion_percentage: number;
  completed_fields: number;
  total_fields: number;
  missing_fields: Array<{ key: string; label: string }>;
}

interface PaymentInstallment {
  id: number;
  course_id: number;
  course_title: string;
  installment_number: number;
  installment_name: string;
  amount: number;
  due_date: string | null;
  status: 'paid' | 'due' | 'overdue';
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  payment_type: 'all_paid' | 'installment';
  created_at: string;
  updated_at: string;
}

const StudentProfilePage = () => {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({});
  const [completion, setCompletion] = useState<CompletionData | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'payment-plan'>('profile');
  const [payments, setPayments] = useState<PaymentInstallment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
    setUserRole((user?.role as UserRole) || null);
    fetchProfile();
  }, []);

  useEffect(() => {
    if (activeTab === 'payment-plan') {
      fetchPayments();
    }
  }, [activeTab]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const [profileRes, completionRes] = await Promise.all([
        apiService.getStudentProfile(),
        apiService.getProfileCompletion()
      ]);

      if (profileRes?.success && profileRes.profile) {
        setProfile(profileRes.profile);
        setProfilePicture(profileRes.profile.profile_picture || null);
        console.log('[Profile Page] Loaded profile data:', profileRes.profile);
        console.log('[Profile Page] ICT Skills value:', profileRes.profile.ict_skills, 'type:', typeof profileRes.profile.ict_skills);
      }

      if (completionRes?.success) {
        setCompletion(completionRes);
        console.log('[Profile Page] Completion data:', completionRes);
        console.log('[Profile Page] Missing fields:', completionRes.missing_fields);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Simplified handleChange function
  const handleChange = (field: keyof ProfileData, value: any) => {
    console.log(`[Frontend] Changing ${field}:`, value, 'type:', typeof value);
    
    // For dropdowns, preserve the actual string value
    let processedValue = value;
    if (value === '' || value === null || value === undefined) {
      processedValue = null;
    } else if (typeof value === 'string') {
      processedValue = value.trim();
      if (processedValue === '') {
        processedValue = null;
      }
    }
    
    console.log(`[Frontend] Processed ${field}:`, processedValue);
    
    setProfile(prev => ({ 
      ...prev, 
      [field]: processedValue 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Create clean payload with only necessary fields
      const payload = {
        gender: profile.gender,
        date_of_birth: profile.date_of_birth,
        nationality: profile.nationality,
        ethnicity: profile.ethnicity,
        current_role: profile.current_role,
        previous_qualification: profile.previous_qualification,
        motivation: profile.motivation,
        vark_visual: profile.vark_visual || 0,
        vark_auditory: profile.vark_auditory || 0,
        vark_reading: profile.vark_reading || 0,
        vark_kinesthetic: profile.vark_kinesthetic || 0,
        english_literacy: profile.english_literacy,
        ict_skills: profile.ict_skills,
        special_learning_needs: profile.special_learning_needs
      };

      console.log('=== SUBMIT DEBUG INFO ===');
      console.log('Payload being sent:', payload);
      console.log('ICT Skills in payload:', payload.ict_skills, 'type:', typeof payload.ict_skills);
      console.log('English Literacy in payload:', payload.english_literacy, 'type:', typeof payload.english_literacy);
      console.log('=== END DEBUG INFO ===');

      const response = await apiService.updateStudentProfile(payload);
      console.log('Profile update response:', response);
      
      if (response?.success) {
        setSuccess('Profile updated successfully!');
        
        // Refresh both profile and completion data
        await fetchProfile();
        
        // If profile is now complete, show success message
        if (response.is_profile_complete) {
          setTimeout(() => {
            router.push('/dashboard/student');
          }, 2000);
        }
      } else {
        const errorMsg = response?.message || 'Failed to update profile';
        setError(errorMsg);
        console.error('Profile update failed:', errorMsg, response);
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      const errorMessage = err?.message || err?.toString() || 'Failed to update profile. Please try again.';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size too large. Please upload an image smaller than 5MB.');
      return;
    }

    setUploadingPicture(true);
    setError('');

    try {
      const response = await apiService.uploadProfilePicture(file);
      
      if (response?.success && response.picture_path) {
        setProfilePicture(response.picture_path);
        setSuccess('Profile picture uploaded successfully!');
        
        // Refresh profile data
        const profileRes = await apiService.getStudentProfile();
        if (profileRes?.success && profileRes.profile) {
          setProfile(profileRes.profile);
        }
        
        window.dispatchEvent(new Event('profile-picture-updated'));
      } else {
        setError(response?.message || 'Failed to upload profile picture');
      }
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setError('Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingPicture(false);
      e.target.value = '';
    }
  };

  const fetchPayments = async () => {
    try {
      setLoadingPayments(true);
      setError('');
      const response = await apiService.getStudentInstallments();
      
      console.log('[Student Profile] Payment installments response:', response);
      
      if (response?.success) {
        const allInstallments: PaymentInstallment[] = [];
        if (response.installments && Array.isArray(response.installments)) {
          response.installments.forEach((courseGroup: any) => {
            console.log('[Student Profile] Course group:', courseGroup);
            if (courseGroup.installments && Array.isArray(courseGroup.installments)) {
              courseGroup.installments.forEach((inst: any) => {
                allInstallments.push({
                  ...inst,
                  course_title: courseGroup.course_title || inst.course_title || 'Unknown Course',
                  course_id: courseGroup.course_id || inst.course_id
                });
              });
            } else if (courseGroup.id) {
              allInstallments.push({
                ...courseGroup,
                course_title: courseGroup.course_title || 'Unknown Course'
              });
            }
          });
        } else if (Array.isArray(response.installments)) {
          allInstallments.push(...response.installments);
        }
        
        console.log('[Student Profile] Processed installments:', allInstallments);
        setPayments(allInstallments);
      } else {
        setPayments([]);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError('Failed to load payment information');
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'due':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const paymentsByCourse = payments.reduce((acc, payment) => {
    if (!acc[payment.course_id]) {
      acc[payment.course_id] = {
        course_id: payment.course_id,
        course_title: payment.course_title,
        payments: []
      };
    }
    acc[payment.course_id].payments.push(payment);
    return acc;
  }, {} as Record<number, { course_id: number; course_title: string; payments: PaymentInstallment[] }>);

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['Student', 'ManagerStudent', 'InstituteStudent']} userRole={userRole}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Student', 'ManagerStudent', 'InstituteStudent']} userRole={userRole}>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header with Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
              {activeTab === 'profile' && completion && (
                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-1">Profile Completion</div>
                  <div className="text-2xl font-bold text-[#11CCEF]">
                    {completion.completion_percentage}%
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'profile'
                      ? 'border-[#11CCEF] text-[#11CCEF]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab('payment-plan')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'payment-plan'
                      ? 'border-[#11CCEF] text-[#11CCEF]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Payment Plan {payments.length > 0 && `(${payments.length})`}
                </button>
              </nav>
            </div>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Profile Tab Content */}
          {activeTab === 'profile' && (
            <>
              {/* Profile Completion Info */}
              {completion && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        completion.is_complete ? 'bg-green-500' : 'bg-[#11CCEF]'
                      }`}
                      style={{ width: `${completion.completion_percentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {completion.completed_fields} of {completion.total_fields} fields completed
                  </p>
                </div>
              )}

              {completion && completion.missing_fields.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <p className="text-sm font-semibold text-yellow-800 mb-2">
                    Missing Required Fields:
                  </p>
                  <ul className="list-disc list-inside text-sm text-yellow-700">
                    {completion.missing_fields.map((field, idx) => (
                      <li key={idx}>{field.label}</li>
                    ))}
                  </ul>
                </div>
              )}

              {completion?.is_complete && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-sm font-semibold text-green-800">
                    ✅ Your profile is complete!
                  </p>
                </div>
              )}

              {/* Profile Form */}
              <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="space-y-6">
                  {/* Profile Picture Upload */}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                      Profile Picture
                    </h2>
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        {profilePicture ? (
                          <img
                            src={profilePicture}
                            alt="Profile"
                            className="w-32 h-32 rounded-full object-cover border-4 border-[#11CCEF] shadow-lg"
                          />
                        ) : (
                          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#11CCEF] to-[#E51791] flex items-center justify-center text-white text-4xl font-bold border-4 border-[#11CCEF] shadow-lg">
                            {JSON.parse(localStorage.getItem('lms-user') || '{}')?.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                        )}
                        {uploadingPicture && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handlePictureUpload}
                            className="hidden"
                            disabled={uploadingPicture}
                          />
                          <span className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] transition-colors font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                            {uploadingPicture ? 'Uploading...' : profilePicture ? 'Change Picture' : 'Upload Picture'}
                          </span>
                        </label>
                        <p className="text-xs text-gray-500 text-center">
                          JPG, PNG, or WEBP. Max 5MB. Image will be cropped to square.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Personal Information */}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                      Personal Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Gender <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={profile.gender || ''}
                          onChange={(e) => handleChange('gender', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          required
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date of Birth <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={profile.date_of_birth || ''}
                          onChange={(e) => handleChange('date_of_birth', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          required
                          max={new Date().toISOString().split('T')[0]}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nationality <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={profile.nationality || ''}
                          onChange={(e) => handleChange('nationality', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Ethnicity
                        </label>
                        <input
                          type="text"
                          value={profile.ethnicity || ''}
                          onChange={(e) => handleChange('ethnicity', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Professional Information */}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                      Professional Information
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Role <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={profile.current_role || ''}
                          onChange={(e) => handleChange('current_role', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          required
                          placeholder="e.g., Healthcare Assistant, Teacher, etc."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Previous Qualification
                        </label>
                        <textarea
                          value={profile.previous_qualification || ''}
                          onChange={(e) => handleChange('previous_qualification', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          placeholder="List your previous qualifications..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Motivation <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={profile.motivation || ''}
                          onChange={(e) => handleChange('motivation', e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          required
                          placeholder="Why are you taking this course? What are your learning goals?"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Learning Style (VARK) */}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                      Learning Style (VARK) <span className="text-red-500">*</span>
                    </h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Rate each learning style from 0 to 20. The total should ideally be around 20, but can vary.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: 'vark_visual', label: 'Visual', desc: 'Learning through seeing' },
                        { key: 'vark_auditory', label: 'Auditory', desc: 'Learning through hearing' },
                        { key: 'vark_reading', label: 'Reading/Writing', desc: 'Learning through reading and writing' },
                        { key: 'vark_kinesthetic', label: 'Kinesthetic', desc: 'Learning through doing' }
                      ].map((style) => (
                        <div key={style.key}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {style.label}
                          </label>
                          <p className="text-xs text-gray-500 mb-1">{style.desc}</p>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={profile[style.key as keyof ProfileData] || 0}
                            onChange={(e) => handleChange(style.key as keyof ProfileData, parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                            required
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Skills & Learning Needs */}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                      Skills & Learning Needs
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          English & Literacy <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={profile.english_literacy || ''}
                          onChange={(e) => handleChange('english_literacy', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          required
                        >
                          <option value="">Select Level</option>
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                          <option value="Native">Native</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ICT Skills <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={profile.ict_skills || ''}
                          onChange={(e) => handleChange('ict_skills', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          required
                        >
                          <option value="">Select Level</option>
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                          <option value="Expert">Expert</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Special Learning Needs
                        </label>
                        <textarea
                          value={profile.special_learning_needs || ''}
                          onChange={(e) => handleChange('special_learning_needs', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11CCEF]"
                          placeholder="Please describe any special learning needs or accommodations required..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard/student')}
                      className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}

          {/* Payment Plan Tab Content */}
          {activeTab === 'payment-plan' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment Plan</h2>
              
              {loadingPayments ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading payment information...</p>
                  </div>
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">💳</div>
                  <p className="text-gray-500 text-lg">No payment installments found.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.values(paymentsByCourse).map((courseGroup) => (
                    <div key={courseGroup.course_id} className="border border-gray-200 rounded-lg p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">{courseGroup.course_title}</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                No.
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Installment
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Amount
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Due Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Paid At
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Reference
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {courseGroup.payments.map((payment) => (
                              <tr key={payment.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {payment.installment_number}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {payment.installment_name}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {formatCurrency(payment.amount)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {formatDate(payment.due_date)}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                      payment.status
                                    )}`}
                                  >
                                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {payment.paid_at ? formatDate(payment.paid_at) : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {payment.payment_reference || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StudentProfilePage;