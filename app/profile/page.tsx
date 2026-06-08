'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { UserRole } from '@/app/components/types';

interface StaffProfileData {
  name?: string;
  email?: string;
  date_of_birth?: string;
  phone?: string;
  address?: string;
  professional_title?: string;
  department?: string;
  bio?: string;
  qualifications?: string;
  specializations?: string;
  profile_picture?: string;
}

const StaffProfilePage = () => {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<StaffProfileData>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || '{}');
    setUserRole((user?.role as UserRole) || null);
    setAuthReady(true);
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiService.getStaffProfile();

      if (response?.success && response.profile) {
        setProfile(response.profile);
        setProfilePicture(response.profile.profile_picture || null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof StaffProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await apiService.updateStaffProfile(profile);

      if (response?.success) {
        setSuccess('Profile updated successfully!');
        setIsEditing(false);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response?.message || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPG, PNG, and WEBP are allowed.');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    try {
      setUploadingPicture(true);
      setError('');

      const formData = new FormData();
      formData.append('picture', file);

      const response = await apiService.uploadStaffProfilePicture(formData);

      if (response?.success) {
        setProfilePicture(response.picture_path || null);
        setSuccess('Profile picture uploaded successfully!');
        setTimeout(() => setSuccess(''), 3000);
        
        // Dispatch event to update navbar
        window.dispatchEvent(new Event('profile-picture-updated'));
      } else {
        setError(response?.message || 'Failed to upload picture');
      }
    } catch (err) {
      console.error('Error uploading picture:', err);
      setError('Failed to upload picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['Admin', 'Assessor', 'Moderator', 'Operation Manager', 'Accounts Manager', 'Admission Manager', 'Administrative Manager', 'Team Member', 'Certificate Manager']} userRole={userRole} authReady={authReady}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF]"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Assessor', 'Moderator', 'Operation Manager', 'Accounts Manager', 'Admission Manager', 'Administrative Manager', 'Team Member', 'Certificate Manager']} userRole={userRole} authReady={authReady}>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
                <p className="text-sm text-gray-600 mt-1">Manage your professional profile and personal information</p>
              </div>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6">
              {success}
            </div>
          )}

          {/* Profile Picture Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Picture</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#11CCEF] to-[#E51791] flex items-center justify-center text-white text-4xl font-bold border-4 border-gray-200">
                    {profile.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                {uploadingPicture && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="picture-upload" className="cursor-pointer">
                  <div className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-opacity-90 transition-all inline-block">
                    {uploadingPicture ? 'Uploading...' : 'Upload New Picture'}
                  </div>
                  <input
                    id="picture-upload"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handlePictureUpload}
                    className="hidden"
                    disabled={uploadingPicture}
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  JPG, PNG or WEBP. Max size 5MB.
                </p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-opacity-90 transition-all"
                >
                  Edit Profile
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name (Read-only from users table) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={profile.name || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Contact admin to change your name</p>
              </div>

              {/* Email (Read-only from users table) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={profile.email || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Contact admin to change your email</p>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={profile.date_of_birth || ''}
                  onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profile.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. +44 20 1234 5678"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                />
              </div>

              {/* Address (Full width) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  value={profile.address || ''}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  disabled={!isEditing}
                  rows={2}
                  placeholder="Your full address"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Professional Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Professional Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Professional Title
                </label>
                <input
                  type="text"
                  value={profile.professional_title || ''}
                  onChange={(e) => handleInputChange('professional_title', e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. Senior Assessor, Course Coordinator"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <input
                  type="text"
                  value={profile.department || ''}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. Computer Science, Business Studies"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                />
              </div>

              {/* Bio (Full width) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio / About Me
                </label>
                <textarea
                  value={profile.bio || ''}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  disabled={!isEditing}
                  rows={4}
                  placeholder="Tell us about yourself, your experience, and teaching philosophy..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                />
              </div>

              {/* Qualifications (Full width) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Qualifications
                </label>
                <textarea
                  value={profile.qualifications || ''}
                  onChange={(e) => handleInputChange('qualifications', e.target.value)}
                  disabled={!isEditing}
                  rows={3}
                  placeholder="List your degrees, certifications, and professional qualifications..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                />
              </div>

              {/* Specializations (Full width) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specializations / Areas of Expertise
                </label>
                <textarea
                  value={profile.specializations || ''}
                  onChange={(e) => handleInputChange('specializations', e.target.value)}
                  disabled={!isEditing}
                  rows={3}
                  placeholder="Your areas of expertise, subjects you teach, research interests..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#11CCEF] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex items-center justify-end gap-4 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <button
                onClick={() => {
                  setIsEditing(false);
                  fetchProfile(); // Reset to original data
                }}
                disabled={saving}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-[#11CCEF] to-[#E51791] text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StaffProfilePage;

