'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';

interface QuizQuestion {
  id: number;
  question_text: string;
  question_type: string;
  order_index: number;
  options: QuizOption[];
}

interface QuizOption {
  id: number;
  option_text: string;
  is_correct: number;
  order_index: number;
}

interface Quiz {
  id: number;
  title: string;
  quiz_type: 'practice' | 'final';
  passing_score: number;
  topic_id: number;
  topic_title: string;
}

const StudentQuizPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const courseId = parseInt(params.courseId as string);
  const quizId = parseInt(params.quizId as string);
  const quizType = searchParams.get('type') as 'practice' | 'final';
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<'Admin' | 'Tutor' | 'Student' | null>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    if (user && user.id) {
      setUserId(user.id);
      setUserRole(user.role);
      loadQuiz();
    }
  }, [quizId]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/cpd/quizzes/${quizId}`);
      const data = await response.json();
      
      if (data.success) {
        setQuiz(data.quiz);
        setQuestions(data.questions);
      }
    } catch (error) {
      console.error('Error loading quiz:', error);
      alert('Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: number, optionId: number) => {
    setAnswers({
      ...answers,
      [questionId]: String(optionId)
    });
  };

  const handleSubmitQuiz = async () => {
    if (!userId) return;
    
    // Check if all questions are answered
    const unansweredCount = questions.length - Object.keys(answers).length;
    if (unansweredCount > 0) {
      if (!confirm(`You have ${unansweredCount} unanswered question(s). Submit anyway?`)) {
        return;
      }
    }

    setSubmitting(true);
    
    try {
      const response = await apiService.submitCPDQuiz(quizId, userId, answers);
      
      if (response.success) {
        setScore(response.score);
        setPassed(response.passed);
        setShowResults(true);
        // Results are displayed in the results UI, no need for alert messages
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToCourse = () => {
    router.push(`/dashboard/student/cpd/${courseId}`);
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['Student']} userRole={userRole}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Loading quiz...</div>
        </div>
      </ProtectedRoute>
    );
  }

  if (showResults) {
    return (
      <ProtectedRoute allowedRoles={['Student']} userRole={userRole}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className={`rounded-lg shadow-lg p-8 text-center ${
              passed ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'
            }`}>
              <div className="text-6xl mb-4">{passed ? '🎉' : '❌'}</div>
              <h1 className="text-3xl font-bold mb-4 text-gray-900">
                {passed ? 'Congratulations!' : 'Not Passed'}
              </h1>
              
              <div className="bg-white rounded-lg p-6 mb-6">
                <div className="text-5xl font-bold mb-2" style={{ color: passed ? '#10b981' : '#ef4444' }}>
                  {score}%
                </div>
                <div className="text-gray-600">
                  Passing Score: {quiz?.passing_score}%
                </div>
              </div>

              {quizType === 'final' && (
                <div className={`p-4 rounded-lg mb-6 ${
                  passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {passed ? (
                    <p className="font-semibold">
                      ✓ Next topic has been unlocked! You can continue your course.
                    </p>
                  ) : (
                    <p className="font-semibold">
                      ✗ You need to pass this final test to unlock the next topic. Please try again!
                    </p>
                  )}
                </div>
              )}

              {quizType === 'practice' && (
                <div className="bg-blue-100 text-blue-800 p-4 rounded-lg mb-6">
                  <p className="font-semibold">
                    This is a practice quiz. You can retake it as many times as you want!
                  </p>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleBackToCourse}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  Back to Course
                </button>
                {!passed && (
                  <button
                    onClick={() => {
                      setShowResults(false);
                      setAnswers({});
                      setScore(0);
                      setPassed(false);
                    }}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Student']} userRole={userRole}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Quiz Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <button
              onClick={handleBackToCourse}
              className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
            >
              ← Back to Course
            </button>
            
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{quiz?.title}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                quizType === 'practice' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {quizType === 'practice' ? '🧪 Practice Quiz' : '🏁 Final Test'}
              </span>
            </div>
            
            <p className="text-gray-600 mb-4">{quiz?.topic_title}</p>
            
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div>📝 {questions.length} Questions</div>
              <div>✓ Passing Score: {quiz?.passing_score}%</div>
              {quizType === 'practice' && <div>♾️ Unlimited Attempts</div>}
              {quizType === 'final' && <div>🔒 Required to unlock next topic</div>}
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-6">
            {questions.map((question, index) => (
              <div key={question.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {question.question_text}
                    </h3>
                    
                    <div className="space-y-3">
                      {question.options.map((option) => (
                        <label
                          key={option.id}
                          className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            answers[question.id] === String(option.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option.id}
                            checked={answers[question.id] === String(option.id)}
                            onChange={() => handleAnswerSelect(question.id, option.id)}
                            className="w-5 h-5 text-blue-600 mr-3"
                          />
                          <span className="text-gray-900">{option.option_text}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="text-gray-600">
                Answered: {Object.keys(answers).length} / {questions.length}
              </div>
              <button
                onClick={handleSubmitQuiz}
                disabled={submitting || Object.keys(answers).length === 0}
                className={`px-8 py-3 rounded-lg font-semibold text-white ${
                  submitting || Object.keys(answers).length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : quizType === 'practice'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {submitting ? 'Submitting...' : 'Submit Quiz'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default StudentQuizPage;

