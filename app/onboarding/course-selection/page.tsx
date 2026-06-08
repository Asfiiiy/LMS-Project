'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingService } from '@/app/services/onboardingService';
import StepProgress from '@/app/components/StepProgress';
import { BookOpen, GraduationCap, CheckCircle, ArrowRight } from 'lucide-react';

export default function CourseSelectionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cpdSelected, setCpdSelected] = useState(false);
  const [qualificationsSelected, setQualificationsSelected] = useState(true);

  const canProceed = cpdSelected || qualificationsSelected;

  const handleContinue = async () => {
    if (!canProceed) return;

    try {
      setLoading(true);
      const response = await onboardingService.saveCourseSelection(cpdSelected, qualificationsSelected);
      
      if (response.success) {
        if (response.next_step === 'qualification-level') {
          router.push('/onboarding/qualification-level');
        } else if (response.next_step === 'initial-assessment') {
          router.push('/onboarding/initial-assessment');
        } else {
          router.push('/onboarding/documents');
        }
      } else {
        alert(response.message || 'Failed to save selection');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error saving course selection:', error);
      alert('Failed to save selection. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Progress indicator */}
        <StepProgress 
          currentStep={1}
          totalSteps={5}
          steps={['Course Type', 'Qualification', 'Documents', 'Assessment', 'Complete']}
        />

        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Choose Your Course Type
          </h1>
          <p className="text-gray-600 mb-8">
            Select your course type to continue.
          </p>

          {/* Options */}
          <div className="grid md:grid-cols-1 gap-6 mb-8 max-w-lg mx-auto">
            {/* Qualifications */}
            <div
              onClick={() => setQualificationsSelected(!qualificationsSelected)}
              className={`
                relative border-2 rounded-xl p-6 cursor-pointer transition-all duration-300
                ${qualificationsSelected 
                  ? 'border-purple-500 bg-purple-50 shadow-lg ring-4 ring-purple-200' 
                  : 'border-gray-300 hover:border-purple-300 hover:shadow-md'}
              `}
            >
              {qualificationsSelected && (
                <div className="absolute top-4 right-4">
                  <CheckCircle className="w-6 h-6 text-purple-500" />
                </div>
              )}
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Qualifications</h3>
              </div>
              
              <p className="text-gray-600 text-sm">
                Nationally recognized qualifications (Levels 2-7) leading to formal certifications and degrees.
              </p>
            </div>
          </div>

          {/* Continue button */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => router.back()}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
            >
              Back
            </button>
            <button
              onClick={handleContinue}
              disabled={!canProceed || loading}
              className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {!canProceed && (
            <p className="text-center text-sm text-red-500 mt-4">
              Please select at least one course type to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
