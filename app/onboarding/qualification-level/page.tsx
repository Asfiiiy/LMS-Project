'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingService } from '@/app/services/onboardingService';
import { QUALIFICATION_LEVELS } from '@/app/types/onboarding.types';
import StepProgress from '@/app/components/StepProgress';
import { CheckCircle, ArrowRight, Info } from 'lucide-react';

export default function QualificationLevelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  useEffect(() => {
    onboardingService.getCourseSelection().then((res) => {
      if (res.success && res.selection && !res.selection.qualifications) {
        router.replace('/onboarding/initial-assessment');
      }
    });
  }, [router]);

  const handleContinue = async () => {
    if (!selectedLevel) return;

    try {
      setLoading(true);
      const response = await onboardingService.saveQualificationLevel(selectedLevel);
      
      if (response.success) {
        router.push('/onboarding/documents');
      } else {
        alert(response.message || 'Failed to save qualification level');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error saving qualification level:', error);
      alert('Failed to save qualification level. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Progress indicator */}
        <StepProgress 
          currentStep={2}
          totalSteps={5}
          steps={['Course Type', 'Qualification', 'Documents', 'Assessment', 'Complete']}
        />

        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Select Your Qualification Level
          </h1>
          <p className="text-gray-600 mb-8">
            Choose the qualification level that matches your current experience and career goals.
          </p>

          {/* Qualification levels */}
          <div className="space-y-4 mb-8">
            {QUALIFICATION_LEVELS.map((qual) => (
              <div
                key={qual.level}
                onClick={() => setSelectedLevel(qual.level)}
                className={`
                  relative border-2 rounded-xl p-6 cursor-pointer transition-all duration-300
                  ${selectedLevel === qual.level 
                    ? 'border-purple-500 bg-purple-50 shadow-lg ring-4 ring-purple-200' 
                    : 'border-gray-300 hover:border-purple-300 hover:shadow-md'}
                `}
              >
                <div className="flex items-start gap-4">
                  {/* Radio indicator */}
                  <div className={`
                    flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1
                    ${selectedLevel === qual.level 
                      ? 'border-purple-500 bg-purple-500' 
                      : 'border-gray-400'}
                  `}>
                    {selectedLevel === qual.level && (
                      <CheckCircle className="w-5 h-5 text-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">
                      {qual.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      {qual.description}
                    </p>
                    
                    {/* Entry requirements */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-blue-900 mb-1">Entry Requirements:</p>
                          <p className="text-xs text-blue-800 whitespace-pre-line">{qual.entryRequirements}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

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
              disabled={!selectedLevel || loading}
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

          {!selectedLevel && (
            <p className="text-center text-sm text-red-500 mt-4">
              Please select a qualification level to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
