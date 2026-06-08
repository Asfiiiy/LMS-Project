'use client';

import React, { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';
import { showToast } from './Toast';

export interface VarkQuestion {
  id: number;
  text: string;
  options: { key: string; text: string; vark: string }[];
}

interface VarkAssessmentProps {
  onComplete: (scores: { vark_visual: number; vark_auditory: number; vark_reading: number; vark_kinesthetic: number }) => void;
  onClose: () => void;
  isRetake?: boolean;
}

const RESULT_MESSAGES: Record<string, string> = {
  V: 'You learn best with diagrams, charts, videos, and visual layouts.',
  A: 'You learn best through discussion, listening, and explanations.',
  R: 'You learn best through reading, writing, and detailed text.',
  K: 'You learn best by doing, practicing, and real-life examples.'
};

const VARK_LABELS: Record<string, string> = {
  V: 'Visual',
  A: 'Aural (Auditory)',
  R: 'Read/Write',
  K: 'Kinesthetic'
};

export default function VarkAssessment({ onComplete, onClose, isRetake }: VarkAssessmentProps) {
  const [questions, setQuestions] = useState<VarkQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{
    scores: { vark_visual: number; vark_auditory: number; vark_reading: number; vark_kinesthetic: number };
    primary: string;
    isMultiModal: boolean;
    primaryMessage: string;
    resultMessages: Record<string, string>;
  } | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await apiService.getVarkQuestions();
        if (res?.success && res.questions) {
          setQuestions(res.questions);
        } else {
          showToast('Failed to load assessment', 'error');
          onClose();
        }
      } catch (e) {
        showToast('Failed to load assessment', 'error');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [onClose]);

  const handleOptionChange = (questionId: number, optionKey: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
  };

  const allAnswered = questions.length === 16 && questions.every((q) => answers[q.id]);

  const handleSubmit = async () => {
    if (!allAnswered) {
      showToast('Please answer all 16 questions', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const answersArray = questions.map((q) => answers[q.id] || '');
      const res = await apiService.submitVarkAssessment(answersArray);
      if (res?.success) {
        setResult({
          scores: res.scores,
          primary: res.primary,
          isMultiModal: res.isMultiModal,
          primaryMessage: res.primaryMessage,
          resultMessages: res.resultMessages || RESULT_MESSAGES
        });
        onComplete(res.scores);
        showToast('Assessment saved successfully', 'success');
      } else {
        showToast(res?.message || 'Failed to save assessment', 'error');
      }
    } catch (e) {
      showToast('Failed to save assessment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#11CCEF] mx-auto mb-4" />
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (result) {
    const { scores, primary, isMultiModal, primaryMessage, resultMessages } = result;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-xl p-6 md:p-8 max-w-lg w-full my-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your VARK Result</h2>
          <p className="text-sm text-gray-600 mb-4">
            This assessment shows learning preferences only. It does not measure intelligence or ability.
          </p>
          <div className="bg-[#11CCEF]/10 border border-[#11CCEF]/30 rounded-lg p-4 mb-4">
            <p className="font-semibold text-gray-900 mb-1">
              {isMultiModal ? 'Multi-Modal Learner' : `${VARK_LABELS[primary]} Learner`}
            </p>
            <p className="text-sm text-gray-700">{primaryMessage}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">Visual</p>
              <p className="text-lg font-bold text-[#11CCEF]">{scores.vark_visual}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">Aural</p>
              <p className="text-lg font-bold text-[#11CCEF]">{scores.vark_auditory}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">Read/Write</p>
              <p className="text-lg font-bold text-[#11CCEF]">{scores.vark_reading}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">Kinesthetic</p>
              <p className="text-lg font-bold text-[#11CCEF]">{scores.vark_kinesthetic}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl p-6 md:p-8 max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            VARK Learning Style Assessment {isRetake ? '(Retake)' : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Answer all 16 questions. Each question has 4 options (A, B, C, D). Choose the one that best describes you.
          Your scores will be calculated automatically and saved to your profile.
        </p>
        <div className="space-y-6">
          {questions.map((q) => (
            <div key={q.id} className="border border-gray-200 rounded-lg p-4">
              <p className="font-medium text-gray-900 mb-3">
                Q{q.id}. {q.text}
              </p>
              <div className="space-y-2">
                {q.options.map((opt) => (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      answers[q.id] === opt.key
                        ? 'border-[#11CCEF] bg-[#11CCEF]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q${q.id}`}
                      value={opt.key}
                      checked={answers[q.id] === opt.key}
                      onChange={() => handleOptionChange(q.id, opt.key)}
                      className="w-4 h-4 text-[#11CCEF]"
                    />
                    <span className="font-medium text-gray-700">{opt.key}.</span>
                    <span className="text-gray-700">{opt.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="flex-1 px-4 py-2 bg-[#11CCEF] text-white rounded-lg hover:bg-[#0daed9] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Submit & Save to Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
