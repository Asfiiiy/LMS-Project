'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/app/contexts/SocketContext';
import { getApiUrl } from '@/app/utils/apiUrl';

interface GradePopup {
  notificationId: number;
  submissionId: number;
  unitId: number;
  courseId: number;
  unitTitle: string;
  courseTitle: string;
  result: 'pass' | 'refer';
  isPass: boolean;
  feedback: string;
  gradedBy: string;
  gradedAt: string;
}

interface Props {
  userId?: number;
  userRole: string;
}

const getStorageKey = (id: number) => `lms_grade_popup_shown_${id}`;

const wasAlreadyShown = (id: number) => {
  try {
    return !!localStorage.getItem(getStorageKey(id));
  } catch {
    return false;
  }
};

const markAsShown = (id: number) => {
  try {
    localStorage.setItem(getStorageKey(id), '1');
  } catch {
    // Non-critical
  }
};

function mapNotificationToPopup(data: Record<string, unknown>): GradePopup | null {
  if (data.type !== 'assignment_graded') return null;

  const notificationId = Number(data.id ?? data.notificationId);
  if (!notificationId || Number.isNaN(notificationId)) return null;

  const rawResult = String(
    data.result ?? data.pass_fail_result ?? 'refer'
  ).toLowerCase();
  const isPass = rawResult === 'pass';

  const courseId = Number(
    data.courseId ?? data.related_course_id ?? 0
  );
  if (!courseId || Number.isNaN(courseId)) return null;

  return {
    notificationId,
    submissionId: Number(
      data.submissionId ?? data.related_submission_id ?? 0
    ),
    unitId: Number(data.unitId ?? data.unit_id ?? 0),
    courseId,
    unitTitle: (data.unitTitle as string) || 'Assignment',
    courseTitle: (data.courseTitle as string) || '',
    result: isPass ? 'pass' : 'refer',
    isPass,
    feedback: (data.feedback as string) || '',
    gradedBy: (data.gradedBy as string) || 'Assessor',
    gradedAt:
      (data.gradedAt as string) ||
      (data.graded_at as string) ||
      new Date().toISOString()
  };
}

export default function GradePopupNotification({ userId, userRole }: Props) {
  const router = useRouter();
  const socket = useSocket();
  const [queue, setQueue] = useState<GradePopup[]>([]);
  const [current, setCurrent] = useState<GradePopup | null>(null);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const processingRef = useRef(false);
  const isStudent = userRole === 'Student';

  const addToQueue = useCallback((popup: GradePopup) => {
    if (wasAlreadyShown(popup.notificationId)) {
      return;
    }
    setQueue(prev => {
      const exists = prev.some(p => p.notificationId === popup.notificationId);
      if (exists) return prev;
      return [...prev, popup];
    });
  }, []);

  const showNext = useCallback(() => {
    if (processingRef.current) return;
    setQueue(prev => {
      if (prev.length === 0) {
        setCurrent(null);
        setVisible(false);
        return prev;
      }
      const next = prev[0];
      setCurrent(next);
      setVisible(true);
      setClosing(false);
      return prev.slice(1);
    });
  }, []);

  useEffect(() => {
    if (!isStudent) return;

    const fetchPending = async () => {
      try {
        const token =
          localStorage.getItem('lms-token') ||
          localStorage.getItem('token') ||
          sessionStorage.getItem('token') ||
          '';

        const res = await fetch(`${getApiUrl()}/api/student/grade-notifications`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) return;

        const data = await res.json();
        if (data.success && data.notifications) {
          data.notifications.forEach((n: Record<string, unknown>) => {
            const popup = mapNotificationToPopup({
              ...n,
              type: 'assignment_graded',
              id: n.notificationId
            });
            if (popup) addToQueue(popup);
          });
        }
      } catch {
        // Non-critical
      }
    };

    setTimeout(fetchPending, 1500);
  }, [isStudent, addToQueue]);

  useEffect(() => {
    if (!socket || !isStudent) return;

    const handleNotification = (data: Record<string, unknown>) => {
      if (data.isGradePopup !== true && data.type !== 'assignment_graded') {
        return;
      }
      const popup = mapNotificationToPopup(data);
      if (popup) addToQueue(popup);
    };

    socket.on('new_notification', handleNotification);

    return () => {
      socket.off('new_notification', handleNotification);
    };
  }, [socket, isStudent, addToQueue]);

  useEffect(() => {
    if (queue.length > 0 && !current) {
      showNext();
    }
  }, [queue, current, showNext]);

  const handleClose = useCallback(() => {
    if (!current) return;
    markAsShown(current.notificationId);
    setClosing(true);
    setTimeout(() => {
      setCurrent(null);
      setVisible(false);
      setClosing(false);
      processingRef.current = false;
      setTimeout(showNext, 300);
    }, 250);
  }, [current, showNext]);

  const handleView = useCallback(() => {
    if (!current) return;
    markAsShown(current.notificationId);
    const url = `/dashboard/student/qualification/${current.courseId}/view`;
    setClosing(true);
    setTimeout(() => {
      setCurrent(null);
      setVisible(false);
      setClosing(false);
      processingRef.current = false;
      router.push(url);
    }, 200);
  }, [current, router]);

  if (!isStudent || !visible || !current) return null;

  const isPass = current.isPass;

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(3px)',
          zIndex: 99998,
          opacity: closing ? 0 : 1,
          transition: 'opacity 0.25s ease'
        }}
      />

      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: closing
            ? 'translate(-50%,-48%) scale(0.95)'
            : 'translate(-50%,-50%) scale(1)',
          zIndex: 99999,
          width: '100%',
          maxWidth: '440px',
          padding: '0 16px',
          opacity: closing ? 0 : 1,
          transition: 'transform 0.25s ease, opacity 0.25s ease',
          animation: 'gradePopupIn 0.35s cubic-bezier(0.175,0.885,0.32,1.275)'
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.06)'
          }}
        >
          <div
            style={{
              background: isPass
                ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                : 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              padding: '28px 24px 20px',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-30px',
                right: '-30px',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)'
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '-20px',
                left: '-20px',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)'
              }}
            />

            {queue.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '14px',
                  right: '14px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '20px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  color: '#fff',
                  fontWeight: '700'
                }}
              >
                +{queue.length} more
              </div>
            )}

            <button
              onClick={handleClose}
              style={{
                position: 'absolute',
                top: '14px',
                left: '14px',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <div
              style={{
                fontSize: '52px',
                marginBottom: '10px',
                position: 'relative',
                zIndex: 1
              }}
            >
              {isPass ? '🎉' : '📋'}
            </div>

            <h2
              style={{
                color: '#fff',
                margin: 0,
                fontSize: '22px',
                fontWeight: '800',
                letterSpacing: '-0.3px',
                position: 'relative',
                zIndex: 1
              }}
            >
              {isPass ? 'Assignment Passed!' : 'Assignment Referred'}
            </h2>

            <p
              style={{
                color: 'rgba(255,255,255,0.85)',
                margin: '6px 0 0',
                fontSize: '13px',
                position: 'relative',
                zIndex: 1
              }}
            >
              {isPass
                ? '🎊 Congratulations on passing!'
                : '📝 Please review feedback and resubmit'}
            </p>
          </div>

          <div style={{ padding: '20px 24px' }}>
            <div
              style={{
                background: isPass ? '#f0fdf4' : '#fff7ed',
                border: `1.5px solid ${isPass ? '#bbf7d0' : '#fed7aa'}`,
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '14px'
              }}
            >
              <p
                style={{
                  margin: '0 0 3px',
                  fontSize: '10px',
                  fontWeight: '700',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}
              >
                Assignment
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: '700',
                  color: '#0f172a',
                  lineHeight: 1.3
                }}
              >
                {current.unitTitle}
              </p>
              {current.courseTitle && (
                <p
                  style={{
                    margin: '3px 0 0',
                    fontSize: '12px',
                    color: '#64748b'
                  }}
                >
                  {current.courseTitle}
                </p>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '18px',
                padding: '10px 14px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #f1f5f9'
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '800',
                  flexShrink: 0
                }}
              >
                {current.gradedBy?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#374151'
                  }}
                >
                  {current.gradedBy}
                </p>
                <p
                  style={{
                    margin: '1px 0 0',
                    fontSize: '11px',
                    color: '#94a3b8'
                  }}
                >
                  {current.gradedAt
                    ? new Date(current.gradedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Just graded'}
                </p>
              </div>
              <span
                style={{
                  background: isPass ? '#dcfce7' : '#ffedd5',
                  color: isPass ? '#16a34a' : '#ea580c',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: '800'
                }}
              >
                {isPass ? '✅ Pass' : '🔄 Refer'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleClose}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1.5px solid #e2e8f0',
                  background: 'transparent',
                  color: '#64748b',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Later
              </button>
              <button
                onClick={handleView}
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isPass
                    ? 'linear-gradient(135deg, #16a34a, #15803d)'
                    : 'linear-gradient(135deg, #ea580c, #c2410c)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: isPass
                    ? '0 4px 12px rgba(22,163,74,0.3)'
                    : '0 4px 12px rgba(234,88,12,0.3)'
                }}
              >
                {isPass ? '🎉 View Result' : '📝 View & Resubmit'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gradePopupIn {
          from {
            opacity: 0;
            transform: translate(-50%,-46%) scale(0.88);
          }
          to {
            opacity: 1;
            transform: translate(-50%,-50%) scale(1);
          }
        }
      `}</style>
    </>
  );
}
