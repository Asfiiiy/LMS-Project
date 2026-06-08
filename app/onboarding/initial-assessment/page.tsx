'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingService } from '@/app/services/onboardingService';
import StepProgress from '@/app/components/StepProgress';
import { ArrowRight, FileText, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';

export default function InitialAssessmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isCpdOnly, setIsCpdOnly] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    gender: '',
    date_of_birth: '',
    nationality: '',
    primary_language: '',
    contact_number: '',
    email: '',
    postal_address: '',
    ethnicity: '',
    why_qualification: '',
    career_goals: '',
    employer_support: '',
    english_literacy: '',
    ict_skills: '',
    special_learning_needs: '',
    data_usage_consent: false,
    assessment_accuracy_consent: false,
    qualification_understanding: false,
    apl_understanding: false,
    privacy_policy_consent: false,
    terms_conditions_consent: false,
    signature_name: '',
    signature_date: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [backUrl, setBackUrl] = useState('/onboarding/documents');

  useEffect(() => {
    Promise.all([
      onboardingService.getCourseSelection(),
      onboardingService.getStatus()
    ]).then(([courseRes, statusRes]) => {
      const et = statusRes.success ? statusRes.enrollment_type : undefined;
      const cpdFromSelection =
        courseRes.success && courseRes.selection && !courseRes.selection.qualifications;
      const cpdFromEnrollment =
        !!et && et.hasCPD && !et.hasQualification;
      const cpdOnly = cpdFromSelection || cpdFromEnrollment;
      const wasAutoDetected = !!et && !et.hasNone;

      if (cpdOnly) {
        setIsCpdOnly(true);
        setBackUrl(wasAutoDetected ? '/onboarding/welcome' : '/onboarding/course-selection');
      } else {
        setBackUrl('/onboarding/documents');
      }
    });
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const token = localStorage.getItem('lms-token');

      // 1) Try to pre-fill from previously saved assessment (e.g. qualification upgrade)
      try {
        const assessmentRes = await onboardingService.getInitialAssessment();
        if (assessmentRes.success && assessmentRes.assessment) {
          const a = assessmentRes.assessment;
          setFormData(prev => ({
            ...prev,
            full_name: a.full_name || prev.full_name,
            gender: a.gender || prev.gender,
            date_of_birth: a.date_of_birth ? new Date(a.date_of_birth).toISOString().split('T')[0] : prev.date_of_birth,
            nationality: a.nationality || prev.nationality,
            primary_language: a.primary_language || prev.primary_language,
            contact_number: a.contact_number || prev.contact_number,
            email: a.email || prev.email,
            postal_address: a.postal_address || prev.postal_address,
            ethnicity: a.ethnicity || prev.ethnicity,
            why_qualification: a.why_qualification || prev.why_qualification,
            career_goals: a.career_goals || prev.career_goals,
            employer_support: a.employer_support || prev.employer_support,
            english_literacy: a.english_literacy || prev.english_literacy,
            ict_skills: a.ict_skills || prev.ict_skills,
            special_learning_needs: a.special_learning_needs || prev.special_learning_needs,
            signature_name: a.signature_name || prev.signature_name,
          }));
        }
      } catch { /* ignore */ }

      // 2) Fetch profile for name/email fallback and profile picture
      if (token) {
        try {
          const response = await fetch(`${window.location.protocol}//${window.location.hostname}${window.location.protocol === 'https:' ? '' : ':5000'}/api/student/profile`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.profile) {
              setFormData(prev => ({
                ...prev,
                full_name: prev.full_name || data.profile.name || '',
                email: prev.email || data.profile.email || ''
              }));
              if (data.profile.profile_picture) {
                setProfilePicture(data.profile.profile_picture);
              }
            }
          }
        } catch { /* ignore */ }
      }

      // 3) Final fallback from localStorage
      if (!token) {
        const userStr = localStorage.getItem('lms-user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            setFormData(prev => ({
              ...prev,
              full_name: prev.full_name || user.name || '',
              email: prev.email || user.email || ''
            }));
          } catch { /* ignore */ }
        }
      }
    };

    loadData();
    setFormData(prev => ({ ...prev, signature_date: new Date().toISOString().split('T')[0] }));
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.date_of_birth) newErrors.date_of_birth = 'Date of birth is required';
    if (!formData.nationality.trim()) newErrors.nationality = 'Nationality is required';
    if (!formData.primary_language.trim()) newErrors.primary_language = 'Primary language is required';
    if (!formData.contact_number.trim()) newErrors.contact_number = 'Contact number is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.postal_address.trim()) newErrors.postal_address = 'Postal address is required';
    if (!formData.ethnicity) newErrors.ethnicity = 'Ethnicity is required';

    if (!isCpdOnly) {
      if (formData.why_qualification.length < 50) {
        newErrors.why_qualification = 'Please provide at least 50 characters';
      }
      if (formData.career_goals.length < 50) {
        newErrors.career_goals = 'Please provide at least 50 characters';
      }
      if (formData.employer_support.length < 50) {
        newErrors.employer_support = 'Please provide at least 50 characters';
      }
      if (!formData.english_literacy) newErrors.english_literacy = 'English & literacy level is required';
      if (!formData.ict_skills) newErrors.ict_skills = 'ICT skills level is required';
      if (!formData.assessment_accuracy_consent) newErrors.assessment_accuracy_consent = 'Required';
      if (!formData.qualification_understanding) newErrors.qualification_understanding = 'Required';
      if (!formData.apl_understanding) newErrors.apl_understanding = 'Required';
    }

    if (!formData.data_usage_consent) newErrors.data_usage_consent = 'Required';
    if (!formData.privacy_policy_consent) newErrors.privacy_policy_consent = 'Required';
    if (!formData.terms_conditions_consent) newErrors.terms_conditions_consent = 'Required';

    if (!formData.signature_name.trim()) newErrors.signature_name = 'Signature name is required';
    if (!formData.signature_date) newErrors.signature_date = 'Signature date is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      alert('Please complete all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await onboardingService.submitInitialAssessment(formData);

      if (response.success) {
        const r = response as {
          next_step?: string;
          cpd_only?: boolean;
          dashboard_access_granted?: boolean;
        };
        if (
          r.next_step === 'dashboard' ||
          r.dashboard_access_granted ||
          r.cpd_only
        ) {
          router.push('/dashboard/student');
        } else if (r.next_step === 'verification-pending') {
          router.push('/onboarding/verification-pending');
        } else if (r.next_step === 'vark' || r.next_step === 'vark-assessment') {
          router.push('/onboarding/vark-assessment');
        } else {
          router.push('/onboarding/vark-assessment');
        }
      } else {
        alert(response.message || 'Failed to submit assessment');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error submitting assessment:', error);
      alert(error.message || 'Failed to submit assessment. Please try again.');
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please upload JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size too large. Please upload an image smaller than 5MB.');
      return;
    }

    setUploadingPicture(true);

    try {
      const token = localStorage.getItem('lms-token');
      const formData = new FormData();
      formData.append('picture', file);

      const response = await fetch(`${window.location.protocol}//${window.location.hostname}${window.location.protocol === 'https:' ? '' : ':5000'}/api/student/profile/picture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (data.success && data.picture_path) {
        setProfilePicture(data.picture_path);
      } else {
        alert(data.message || 'Failed to upload profile picture');
      }
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      alert('Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingPicture(false);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <StepProgress 
          currentStep={4}
          totalSteps={5}
          steps={['Course Type', 'Qualification', 'Documents', 'Assessment', 'Complete']}
        />

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-start gap-3 mb-6">
            <FileText className="w-8 h-8 text-purple-600 flex-shrink-0" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Initial Assessment Form
              </h1>
              <p className="text-gray-600">
                Please complete this form accurately. All fields marked with * are required.
              </p>
            </div>
          </div>

          {/* Personal Information */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Personal Information
            </h2>

            {/* Profile Picture Upload */}
            <div className="mb-6 flex flex-col items-center">
              <div className="relative mb-3">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-purple-500" />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-4xl font-bold">
                    {formData.full_name ? formData.full_name.charAt(0).toUpperCase() : 'U'}
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
                  <span className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm cursor-pointer">
                    {uploadingPicture ? 'Uploading...' : profilePicture ? 'Change Photo' : 'Upload Photo'}
                  </span>
                </label>
                {profilePicture && !uploadingPicture && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Are you sure you want to remove your profile picture?')) {
                        setProfilePicture(null);
                      }
                    }}
                    className="text-sm text-red-600 hover:text-red-700 hover:underline"
                  >
                    Remove Photo
                  </button>
                )}
                <p className="text-xs text-gray-500 text-center">JPG, PNG, or WEBP. Max 5MB</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.full_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender *
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.gender ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
                {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  max={new Date().toISOString().split('T')[0]}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.date_of_birth ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.date_of_birth && <p className="text-red-500 text-xs mt-1">{errors.date_of_birth}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nationality *
                </label>
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.nationality ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.nationality && <p className="text-red-500 text-xs mt-1">{errors.nationality}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Language *
                </label>
                <input
                  type="text"
                  name="primary_language"
                  value={formData.primary_language}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.primary_language ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.primary_language && <p className="text-red-500 text-xs mt-1">{errors.primary_language}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Number *
                </label>
                <input
                  type="tel"
                  name="contact_number"
                  value={formData.contact_number}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.contact_number ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.contact_number && <p className="text-red-500 text-xs mt-1">{errors.contact_number}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  placeholder="Your email address"
                />
                <p className="text-xs text-gray-500 mt-1">This is your login email and cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ethnicity *
                </label>
                <input
                  type="text"
                  name="ethnicity"
                  value={formData.ethnicity}
                  onChange={handleChange}
                  placeholder="Enter your ethnicity"
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.ethnicity ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.ethnicity && <p className="text-red-500 text-xs mt-1">{errors.ethnicity}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Postal Address *
                </label>
                <textarea
                  name="postal_address"
                  value={formData.postal_address}
                  onChange={handleChange}
                  rows={3}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.postal_address ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.postal_address && <p className="text-red-500 text-xs mt-1">{errors.postal_address}</p>}
              </div>
            </div>
          </div>

          {/* Motivation & Background — qualification students only */}
          {!isCpdOnly && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Motivation & Background
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Why do you want to pursue this qualification? * (min 50 characters)
                </label>
                <textarea
                  name="why_qualification"
                  value={formData.why_qualification}
                  onChange={handleChange}
                  rows={4}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.why_qualification ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <div className="flex justify-between items-center mt-1">
                  {errors.why_qualification && <p className="text-red-500 text-xs">{errors.why_qualification}</p>}
                  <p className="text-xs text-gray-500 ml-auto">{formData.why_qualification.length}/50</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What are your career goals? * (min 50 characters)
                </label>
                <textarea
                  name="career_goals"
                  value={formData.career_goals}
                  onChange={handleChange}
                  rows={4}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.career_goals ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <div className="flex justify-between items-center mt-1">
                  {errors.career_goals && <p className="text-red-500 text-xs">{errors.career_goals}</p>}
                  <p className="text-xs text-gray-500 ml-auto">{formData.career_goals.length}/50</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Do you have support from your employer? * (min 50 characters)
                </label>
                <textarea
                  name="employer_support"
                  value={formData.employer_support}
                  onChange={handleChange}
                  rows={4}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.employer_support ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <div className="flex justify-between items-center mt-1">
                  {errors.employer_support && <p className="text-red-500 text-xs">{errors.employer_support}</p>}
                  <p className="text-xs text-gray-500 ml-auto">{formData.employer_support.length}/50</p>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Skills Assessment — qualification students only */}
          {!isCpdOnly && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Skills Assessment
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  English & Literacy Skills *
                </label>
                <select
                  name="english_literacy"
                  value={formData.english_literacy}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.english_literacy ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select level</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Native">Native</option>
                </select>
                {errors.english_literacy && <p className="text-red-500 text-xs mt-1">{errors.english_literacy}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ICT Skills *
                </label>
                <select
                  name="ict_skills"
                  value={formData.ict_skills}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.ict_skills ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select level</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
                {errors.ict_skills && <p className="text-red-500 text-xs mt-1">{errors.ict_skills}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Learning Needs (Optional)
                </label>
                <textarea
                  name="special_learning_needs"
                  value={formData.special_learning_needs}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Please describe any special learning needs or requirements"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
          )}

          {/* E-Signature & Agreements */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              E-Signature & Agreements
            </h2>
            
            <div className="space-y-4 mb-6">
              <div className={`flex items-start gap-3 p-3 rounded-lg ${errors.data_usage_consent ? 'bg-red-50' : ''}`}>
                <input
                  type="checkbox"
                  name="data_usage_consent"
                  checked={formData.data_usage_consent}
                  onChange={handleChange}
                  className="mt-1 w-5 h-5 text-purple-600"
                />
                <label className="text-sm text-gray-700">
                  I consent to the college using my data for academic and administrative purposes *
                </label>
              </div>

              {!isCpdOnly && (
              <div className={`flex items-start gap-3 p-3 rounded-lg ${errors.assessment_accuracy_consent ? 'bg-red-50' : ''}`}>
                <input
                  type="checkbox"
                  name="assessment_accuracy_consent"
                  checked={formData.assessment_accuracy_consent}
                  onChange={handleChange}
                  className="mt-1 w-5 h-5 text-purple-600"
                />
                <label className="text-sm text-gray-700">
                  I confirm that all information provided in this assessment is accurate and complete *
                </label>
              </div>
              )}

              {!isCpdOnly && (
              <div className={`flex items-start gap-3 p-3 rounded-lg ${errors.qualification_understanding ? 'bg-red-50' : ''}`}>
                <input
                  type="checkbox"
                  name="qualification_understanding"
                  checked={formData.qualification_understanding}
                  onChange={handleChange}
                  className="mt-1 w-5 h-5 text-purple-600"
                />
                <label className="text-sm text-gray-700">
                  I understand the requirements and expectations of this qualification *
                </label>
              </div>
              )}

              {!isCpdOnly && (
              <div className={`flex items-start gap-3 p-3 rounded-lg ${errors.apl_understanding ? 'bg-red-50' : ''}`}>
                <input
                  type="checkbox"
                  name="apl_understanding"
                  checked={formData.apl_understanding}
                  onChange={handleChange}
                  className="mt-1 w-5 h-5 text-purple-600"
                />
                <label className="text-sm text-gray-700">
                  I understand the Accreditation of Prior Learning (APL) process if applicable *
                </label>
              </div>
              )}

              <div className={`flex items-start gap-3 p-3 rounded-lg ${errors.privacy_policy_consent ? 'bg-red-50' : ''}`}>
                <input
                  type="checkbox"
                  name="privacy_policy_consent"
                  checked={formData.privacy_policy_consent}
                  onChange={handleChange}
                  className="mt-1 w-5 h-5 text-purple-600"
                  aria-describedby="privacy-policy-consent-desc"
                />
                <label id="privacy-policy-consent-desc" className="text-sm text-gray-700">
                  I have read and agree to the{' '}
                  <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 underline font-medium">
                    Privacy Policy
                  </Link>{' '}
                  *
                </label>
              </div>

              <div className={`flex items-start gap-3 p-3 rounded-lg ${errors.terms_conditions_consent ? 'bg-red-50' : ''}`}>
                <input
                  type="checkbox"
                  name="terms_conditions_consent"
                  checked={formData.terms_conditions_consent}
                  onChange={handleChange}
                  className="mt-1 w-5 h-5 text-purple-600"
                  aria-describedby="terms-conditions-consent-desc"
                />
                <label id="terms-conditions-consent-desc" className="text-sm text-gray-700">
                  I have read and agree to the{' '}
                  <Link href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 underline font-medium">
                    Terms & Conditions
                  </Link>{' '}
                  *
                </label>
              </div>
            </div>

            {!isCpdOnly && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <strong>Important Note:</strong> APL (Accreditation of Prior Learning) allows you to gain credit for relevant prior learning and experience. If you believe you have relevant prior qualifications or experience, please discuss with your assessor.
                </div>
              </div>
            </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name (for E-Signature) *
                </label>
                <input
                  type="text"
                  name="signature_name"
                  value={formData.signature_name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.signature_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.signature_name && <p className="text-red-500 text-xs mt-1">{errors.signature_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  name="signature_date"
                  value={formData.signature_date}
                  onChange={handleChange}
                  max={new Date().toISOString().split('T')[0]}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.signature_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.signature_date && <p className="text-red-500 text-xs mt-1">{errors.signature_date}</p>}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={() => router.push(backUrl)}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Submitting...
                </>
              ) : (
                <>
                  Submit Assessment
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
