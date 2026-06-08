'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import { onboardingService } from '@/app/services/onboardingService';
import StepProgress from '@/app/components/StepProgress';
import { Sparkles, ArrowRight, CheckCircle } from 'lucide-react';

export default function VarkAssessmentPage() {
  const router = useRouter();
  const [varkCompleted, setVarkCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCpdOnly, setIsCpdOnly] = useState(false);

  // VARK Assessment State
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    checkVarkStatusAndLoadQuestions();
    onboardingService.getCourseSelection().then((res) => {
      if (res.success && res.selection && !res.selection.qualifications) {
        setIsCpdOnly(true);
      }
    });
  }, []);

  const checkVarkStatusAndLoadQuestions = async () => {
    try {
      // Check if VARK already completed
      const profileResponse = await apiService.getStudentProfile();
      if (profileResponse?.success && profileResponse.profile) {
        const hasVarkScores = 
          profileResponse.profile.vark_visual > 0 ||
          profileResponse.profile.vark_auditory > 0 ||
          profileResponse.profile.vark_reading > 0 ||
          profileResponse.profile.vark_kinesthetic > 0;
        
        if (hasVarkScores) {
          setVarkCompleted(true);
          setLoading(false);
          return;
        }
      }

      // Load questions if not completed
      const questionsResponse = await apiService.getVarkQuestions();
      if (questionsResponse?.success) {
        setQuestions(questionsResponse.questions);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading VARK assessment:', error);
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: number, optionKey: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const handleSubmit = async () => {
    const answerArray = questions.map(q => answers[q.id] || '');
    const allAnswered = answerArray.every(a => a !== '');

    if (!allAnswered) {
      alert('Please answer all 16 questions before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiService.submitVarkAssessment(answerArray);
      
      if (response?.success) {
        setResults(response);
        setShowResults(true);
        
        // Update onboarding status (CPD-only gets dashboard access auto-granted by backend)
        await onboardingService.updateStatus({
          vark_assessment_completed: true,
          current_step: 'verification-pending'
        });
      } else {
        alert(response?.message || 'Failed to submit assessment');
      }
    } catch (error: any) {
      console.error('Error submitting VARK:', error);
      alert(error.message || 'Failed to submit assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (isCpdOnly) {
      router.push('/dashboard/student');
    } else {
      router.push('/onboarding/verification-pending');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#11CCEF] mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <StepProgress 
          currentStep={5}
          totalSteps={5}
          steps={['Course Type', 'Qualification', 'Documents', 'Assessment', 'Complete']}
        />

        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-start gap-3 mb-6">
            <Sparkles className="w-8 h-8 text-purple-600 flex-shrink-0" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Learning Style Assessment (VARK)
              </h1>
              <p className="text-gray-600">
                Complete this quick 16-question assessment to discover your learning style.
              </p>
            </div>
          </div>

          {varkCompleted ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Complete!</h2>
              <p className="text-gray-600 mb-6">You've already completed the VARK assessment.</p>
              
              <button
                onClick={handleContinue}
                className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg mx-auto"
              >
                {isCpdOnly ? 'Continue to Dashboard' : 'Continue to Verification'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : showResults ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Assessment Complete!</h2>
              
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Your Learning Style Results:</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Visual</div>
                    <div className="text-2xl font-bold text-[#11CCEF]">{results.scores?.vark_visual || 0}</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Auditory</div>
                    <div className="text-2xl font-bold text-[#11CCEF]">{results.scores?.vark_auditory || 0}</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Reading</div>
                    <div className="text-2xl font-bold text-[#11CCEF]">{results.scores?.vark_reading || 0}</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Kinesthetic</div>
                    <div className="text-2xl font-bold text-[#11CCEF]">{results.scores?.vark_kinesthetic || 0}</div>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mt-4">{results.primaryMessage}</p>
              </div>

              <button
                onClick={handleContinue}
                className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg mx-auto"
              >
                {isCpdOnly ? 'Continue to Dashboard' : 'Continue to Verification'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900">
                  <strong>About VARK:</strong> Answer all 16 questions to discover whether you're a Visual, Auditory, Reading/Writing, or Kinesthetic learner.
                </p>
              </div>

              <div className="space-y-6 mb-8">
                {questions.map((question, index) => (
                  <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      {index + 1}. {question.text}
                    </h3>
                    <div className="space-y-2">
                      {question.options.map((option: any) => (
                        <label
                          key={option.key}
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                            answers[question.id] === option.key
                              ? 'bg-purple-50 border-2 border-purple-500'
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option.key}
                            checked={answers[question.id] === option.key}
                            onChange={() => handleAnswerSelect(question.id, option.key)}
                            className="mt-1 w-4 h-4 text-purple-600"
                          />
                          <span className="text-sm text-gray-700">{option.text}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Answered: {Object.keys(answers).length} / {questions.length}
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={Object.keys(answers).length !== questions.length || submitting}
                  className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

