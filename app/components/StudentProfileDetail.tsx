'use client';

interface StudentProfile {
  user_id: number;
  name: string;
  email: string;
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
  profile_picture?: string;
  is_profile_complete?: number;
  profile_completed_at?: string | null;
  updated_at?: string | null;
}

interface StudentProfileDetailProps {
  student: StudentProfile;
  onClose: () => void;
  isPageView?: boolean;
}

const StudentProfileDetail = ({ student, onClose, isPageView = false }: StudentProfileDetailProps) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not provided';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getVARKSummary = () => {
    const scores = [
      { label: 'Visual', value: student.vark_visual || 0 },
      { label: 'Auditory', value: student.vark_auditory || 0 },
      { label: 'Reading', value: student.vark_reading || 0 },
      { label: 'Kinesthetic', value: student.vark_kinesthetic || 0 }
    ];
    
    const maxScore = Math.max(...scores.map(s => s.value));
    const dominant = scores.filter(s => s.value === maxScore).map(s => s.label);
    
    return {
      scores,
      dominant: dominant.join(', '),
      maxScore
    };
  };

  const varkData = getVARKSummary();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#11CCEF] to-[#0daed9] text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {student.profile_picture ? (
                <img
                  src={student.profile_picture}
                  alt={student.name}
                  className="h-16 w-16 rounded-full object-cover border-2 border-white"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-white text-[#11CCEF] flex items-center justify-center text-2xl font-bold border-2 border-white">
                  {student.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold">{student.name}</h2>
                <p className="text-blue-100">{student.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Personal Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Gender</label>
                  <p className="text-gray-900">{student.gender || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                  <p className="text-gray-900">{formatDate(student.date_of_birth)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Nationality</label>
                  <p className="text-gray-900">{student.nationality || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Ethnicity</label>
                  <p className="text-gray-900">{student.ethnicity || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Professional Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Current Role</label>
                  <p className="text-gray-900">{student.current_role || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Previous Qualification</label>
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {student.previous_qualification || 'Not provided'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Motivation</label>
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {student.motivation || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* Learning Style (VARK) */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Learning Style (VARK)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {varkData.scores.map((score) => (
                  <div key={score.label} className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-500 mb-2">{score.label}</div>
                    <div className="text-2xl font-bold text-[#11CCEF]">{score.value}</div>
                    <div className="mt-2 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#11CCEF] h-2 rounded-full"
                        style={{ width: `${(score.value / 20) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Dominant Learning Style:</span> {varkData.dominant}
                  {varkData.maxScore > 0 && ` (Score: ${varkData.maxScore}/20)`}
                </p>
              </div>
            </div>

            {/* Skills & Needs */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Skills & Learning Needs
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">English & Literacy</label>
                  <p className="text-gray-900">{student.english_literacy || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">ICT Skills</label>
                  <p className="text-gray-900">{student.ict_skills || 'Not provided'}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Special Learning Needs</label>
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {student.special_learning_needs || 'None identified'}
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Status */}
            <div className="md:col-span-2 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-500">Profile Status</label>
                  <p className="text-gray-900">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        student.is_profile_complete === 1
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {student.is_profile_complete === 1 ? 'Complete' : 'Incomplete'}
                    </span>
                  </p>
                </div>
                {student.profile_completed_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Completed At</label>
                    <p className="text-gray-900">{formatDate(student.profile_completed_at)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfileDetail;

