'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';

const QuizAttemptPage = () => {
  const params = useParams();
  const router = useRouter();
  const quizId = Number(params?.id);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!quizId) return;
      try {
        const res = await apiService.getQuiz(quizId);
        if (res.success) {
          setQuiz(res.quiz);
          // Parse options - handle both string and already parsed
          const parsedQuestions = (res.questions || []).map((q: any) => {
            let options = [];
            try {
              if (typeof q.options === 'string') {
                options = JSON.parse(q.options || '[]');
              } else if (Array.isArray(q.options)) {
                options = q.options;
              } else {
                options = [];
              }
            } catch (e) {
              console.error('Error parsing options:', e);
              options = [];
            }
            return { ...q, options };
          });
          setQuestions(parsedQuestions);
        } else {
          alert('Failed to load quiz');
        }
      } catch (error) {
        console.error('Error fetching quiz:', error);
        alert('Error loading quiz');
      }
    })();
  }, [quizId]);

  const submit = async () => {
    const user = JSON.parse(localStorage.getItem('lms-user') || 'null');
    const payload = Object.entries(answers).map(([qid, ans]) => ({ question_id: Number(qid), answer: String(ans) }));
    const res = await apiService.attemptQuiz(quizId, user?.id || null, payload);
    if (res.success) setResult(res); else alert('Submit failed');
  };

  if (!quiz) return <div className="min-h-screen p-6">Loading...</div>;

  return (
    <div className="min-h-screen p-6 bg-gray-100">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded shadow-sm flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{quiz.title}</h1>
            <div className="text-gray-600">Answer all questions and submit.</div>
          </div>
          <button onClick={() => router.back()} className="px-4 py-2 bg-[#11CCEF] text-white rounded">Back</button>
        </div>

        <div className="bg-white p-6 rounded shadow-sm">
          {questions.length === 0 ? (
            <div className="text-gray-500 text-center py-8">No questions found in this quiz.</div>
          ) : (
            questions.map((q) => (
              <div key={q.id} className="mb-6 pb-6 border-b border-gray-200 last:border-0">
                <div className="font-medium mb-3 text-lg">{q.question}</div>
                <div className="space-y-2">
                  {q.options && q.options.length > 0 ? (
                    q.options.map((opt: string, idx: number) => (
                      <label key={idx} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input 
                          type="radio" 
                          name={`q-${q.id}`} 
                          value={opt} 
                          checked={answers[q.id] === opt}
                          onChange={(e)=>setAnswers(prev=>({...prev, [q.id]: e.target.value}))} 
                          className="w-4 h-4"
                        />
                        <span className="flex-1">{opt}</span>
                      </label>
                    ))
                  ) : (
                    <div className="text-gray-400 text-sm">No options available</div>
                  )}
                </div>
              </div>
            ))
          )}
          {!result ? (
            <button onClick={submit} className="px-4 py-2 bg-green-600 text-white rounded">Submit</button>
          ) : (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <div className="font-semibold text-green-800">Score: {result.score}%</div>
              <div className="text-green-700">Correct {result.correct} / {result.total}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizAttemptPage;






