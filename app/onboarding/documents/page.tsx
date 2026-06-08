'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingService } from '@/app/services/onboardingService';
import type { StudentDocument } from '@/app/types/onboarding.types';
import StepProgress from '@/app/components/StepProgress';
import DocumentUploader from '@/app/components/DocumentUploader';
import { ArrowRight, FileText, AlertCircle } from 'lucide-react';

export default function DocumentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [error, setError] = useState('');
  const [qualificationLevel, setQualificationLevel] = useState<{
    level: number;
    title: string;
    description: string;
    requirements: string;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // CPD-only students skip documents - redirect to initial-assessment
      const courseResponse = await onboardingService.getCourseSelection();
      if (courseResponse.success && courseResponse.selection) {
        const { qualifications } = courseResponse.selection;
        if (!qualifications) {
          router.replace('/onboarding/initial-assessment');
          return;
        }
      }

      // Fetch documents
      const docsResponse = await onboardingService.getDocuments();
      if (docsResponse.success) {
        setDocuments(docsResponse.documents);
      }

      // Always try to fetch qualification level (don't wait for status flag)
      try {
        const qualResponse = await fetch('/api/onboarding/qualification-level', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('lms-token')}`,
            'Content-Type': 'application/json'
          }
        });
        const qualData = await qualResponse.json();

        if (qualData.success && qualData.selection && qualData.selection.level) {
          const level = qualData.selection.level;

          const QUALIFICATION_LEVELS: any = {
            2: { 
              title: 'Level 2', 
              description: 'Foundation level qualification for health and social care',
              requirements: 'Work experience in the health and social care sector and demonstrate ambition with clear career goals; OR a Level 2 qualification in another discipline and want to develop their careers in health and social care.' 
            },
            3: { 
              title: 'Level 3', 
              description: 'Advanced level qualification',
              requirements: 'GCSE, Level 2 qualification, Secondary School Certificate, or equivalent.' 
            },
            4: { 
              title: 'Level 4', 
              description: 'Higher education certificate level',
              requirements: 'Level 3 qualification, HND, ND, O Levels, Bachelor\'s degree, or equivalent.' 
            },
            5: { 
              title: 'Level 5', 
              description: 'Higher education diploma level',
              requirements: 'Level 4 qualification, Bachelor\'s degree, HND, or Master\'s degree.' 
            },
            6: { 
              title: 'Level 6', 
              description: 'Bachelor\'s degree level',
              requirements: 'Bachelor\'s degree or Master\'s degree with relevant work experience.' 
            },
            7: { 
              title: 'Level 7', 
              description: 'Master\'s degree level',
              requirements: 'Bachelor\'s degree or Master\'s degree with relevant professional experience.' 
            }
          };
          
          if (QUALIFICATION_LEVELS[level]) {
            setQualificationLevel({
              level,
              title: QUALIFICATION_LEVELS[level].title,
              description: QUALIFICATION_LEVELS[level].description,
              requirements: QUALIFICATION_LEVELS[level].requirements
            });
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log('No qualification selection found or invalid data');
          }
        }
      } catch (qualError) {
      }

    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (document: StudentDocument) => {
    setDocuments(prev => [...prev, document]);
  };

  const handleDeleteSuccess = (documentId: number) => {
    setDocuments(prev => prev.filter(d => d.id !== documentId));
  };

  const refreshDocuments = async () => {
    const docsResponse = await onboardingService.getDocuments();
    if (docsResponse.success) {
      setDocuments(docsResponse.documents);
    }
  };

  const activeDocs = documents.filter(d => d.status !== 'replaced');
  const hasQualification = activeDocs.some(
    d => d.document_type === 'qualification' && d.status !== 'rejected'
  );
  const hasIdentity = activeDocs.some(d => d.document_type === 'identity' && d.status !== 'rejected');
  const hasCV = activeDocs.some(d => d.document_type === 'cv' && d.status !== 'rejected');
  const hasAddress = activeDocs.some(d => d.document_type === 'address' && d.status !== 'rejected');
  const canProceed = hasQualification && hasIdentity && hasCV && hasAddress;

  const handleContinue = async () => {
    if (!canProceed) return;

    try {
      setSubmitting(true);
      await onboardingService.updateStatus({
        documents_uploaded: true,
        current_step: 'initial-assessment'
      });
      router.push('/onboarding/initial-assessment');
    } catch (error) {
      alert('Failed to proceed. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#11CCEF] mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Progress indicator */}
        <StepProgress 
          currentStep={3}
          totalSteps={5}
          steps={['Course Type', 'Qualification', 'Documents', 'Assessment', 'Complete']}
        />

        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-start gap-3 mb-6">
            <FileText className="w-8 h-8 text-purple-600 flex-shrink-0" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Upload Your Documents
              </h1>
              <p className="text-gray-600">
                Please upload all required documents for verification. All sections must be completed.
              </p>
            </div>
          </div>

          {/* Document sections */}
          <div className="space-y-8 mb-8">
            {/* Section A: Qualification Documents */}
            <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  hasQualification ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  A
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {qualificationLevel ? qualificationLevel.title : 'Qualification Documents'} {hasQualification && '✓'}
                </h2>
              </div>
              
              {qualificationLevel && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    {qualificationLevel.description}
                  </p>
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Entry Requirements:</p>
                    <p className="text-sm text-blue-800">{qualificationLevel.requirements}</p>
                  </div>
                </div>
              )}
              
              <p className="text-sm text-gray-600 mb-4">
                Upload PDF copies of your previous qualifications, certificates, or diplomas that meet the above entry requirements. You can upload multiple files.
              </p>
              <DocumentUploader
                documentType="qualification"
                title=""
                acceptedFormats={['.pdf']}
                maxSizeMB={5}
                multiple={true}
                documents={documents}
                onUploadSuccess={handleUploadSuccess}
                onDeleteSuccess={handleDeleteSuccess}
                onRefreshDocuments={refreshDocuments}
              />
            </div>

            {/* Section B: Proof of Identity */}
            <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  hasIdentity ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  B
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Proof of Identity {hasIdentity && '✓'}
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Upload clear photos or scans of your passport, driver's license, or national ID card. You can upload multiple files if needed.
              </p>
              <DocumentUploader
                documentType="identity"
                title=""
                acceptedFormats={['.jpg', '.jpeg', '.png', '.pdf']}
                maxSizeMB={5}
                multiple={true}
                documents={documents}
                onUploadSuccess={handleUploadSuccess}
                onDeleteSuccess={handleDeleteSuccess}
                onRefreshDocuments={refreshDocuments}
              />
            </div>

            {/* Section C: Updated CV */}
            <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  hasCV ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  C
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Updated CV/Resume {hasCV && '✓'}
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Upload your current CV or resume showing your education and work experience. You can upload multiple versions if needed.
              </p>
              <DocumentUploader
                documentType="cv"
                title=""
                acceptedFormats={['.pdf', '.doc', '.docx']}
                maxSizeMB={5}
                multiple={true}
                documents={documents}
                onUploadSuccess={handleUploadSuccess}
                onDeleteSuccess={handleDeleteSuccess}
                onRefreshDocuments={refreshDocuments}
              />
            </div>

            {/* Section D: Proof of Address */}
            <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  hasAddress ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  D
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Proof of Address {hasAddress && '✓'}
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Upload proof of address dated within the last 3 months. Acceptable documents include:
                <br />• Utility bills (gas, electricity, water)
                <br />• Council tax statement
                <br />• Bank or building society statement
                <br />• Mortgage statement
                <br />
                Document must clearly show your name and address. You can upload multiple files.
              </p>
              <DocumentUploader
                documentType="address"
                title=""
                acceptedFormats={['.jpg', '.jpeg', '.png', '.pdf']}
                maxSizeMB={5}
                multiple={true}
                documents={documents}
                onUploadSuccess={handleUploadSuccess}
                onDeleteSuccess={handleDeleteSuccess}
                onRefreshDocuments={refreshDocuments}
              />
            </div>
          </div>

          {/* Status indicator */}
          {!canProceed && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-900 mb-1">Documents Required</p>
                <p className="text-sm text-yellow-800">
                  Please upload at least one document in each section (A, B, C, and D) to proceed.
                </p>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => router.back()}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
            >
              Back
            </button>
            <button
              onClick={handleContinue}
              disabled={!canProceed || submitting}
              className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  Continue to Assessment
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
