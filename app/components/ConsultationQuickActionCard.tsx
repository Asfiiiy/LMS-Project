'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/app/services/api';

interface Booking {
  id: number;
  slot_id: number;
  date: string;
  start_time: string;
  end_time: string;
  zoom_join_url?: string;
  status: string;
}

interface Slot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
}

interface ConsultationQuickActionCardProps {
  bookings: Booking[];
  slots: Slot[];
  byDate: Record<string, Slot[]>;
  loading?: boolean;
  onRefresh?: () => void;
}

function formatDateShort(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTimeAMPM(t: string) {
  const [h, m] = String(t).slice(0, 5).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function ConsultationQuickActionCard({
  bookings,
  slots,
  byDate,
  loading = false,
  onRefresh
}: ConsultationQuickActionCardProps) {
  const router = useRouter();
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [showZoom, setShowZoom] = useState(false);
  const [carouselSlide, setCarouselSlide] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const now = new Date(Date.now() + serverTimeOffset);
  const upcomingBookings = bookings
    .filter(b => {
      const d = new Date(`${b.date}T${b.start_time}`);
      return d >= now && !['cancelled', 'completed'].includes(b.status);
    })
    .sort((a, b) => new Date(`${a.date}T${a.start_time}`).getTime() - new Date(`${b.date}T${b.start_time}`).getTime());

  const nextBooking = upcomingBookings[0];
  const hasBooking = !!nextBooking;

  const slotDate = nextBooking ? new Date(`${nextBooking.date}T${nextBooking.start_time}`) : null;
  const msUntil = slotDate ? slotDate.getTime() - now.getTime() : 0;
  const hrsUntil = msUntil / (1000 * 60 * 60);
  const minsUntil = msUntil / (1000 * 60);
  const within24h = hrsUntil > 0 && hrsUntil <= 24;
  const within1h = hrsUntil > 0 && hrsUntil <= 1;
  const within15min = minsUntil > 0 && minsUntil <= 15;

  const handleClick = useCallback(() => {
    const tab = hasBooking ? 'my-bookings' : 'book';
    router.push(`/dashboard/student/consultations?tab=${tab}`);
  }, [hasBooking, router]);

  useEffect(() => {
    let cancelled = false;
    async function fetchTime() {
      try {
        const res = await apiService.getServerTime();
        if (res?.serverTime && !cancelled) {
          const serverDate = new Date(res.serverTime);
          setServerTimeOffset(serverDate.getTime() - Date.now());
        }
      } catch {
        if (!cancelled) setServerTimeOffset(0);
      }
    }
    fetchTime();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!nextBooking) return;
    const slotDate = new Date(`${nextBooking.date}T${nextBooking.start_time}`);
    const update = () => {
      const now = new Date(Date.now() + serverTimeOffset);
      const msUntil = slotDate.getTime() - now.getTime();
      if (msUntil <= 0) {
        setCountdown(null);
        setShowZoom(false);
        onRefresh?.();
        return;
      }
      const hrsUntil = msUntil / (1000 * 60 * 60);
      const minsUntil = msUntil / (1000 * 60);
      const within24h = hrsUntil <= 24;
      const within1h = hrsUntil <= 1;
      const within15min = minsUntil <= 15;

      setShowZoom(within15min);

      if (!within24h) {
        setCountdown(null);
        return;
      }
      if (within15min) {
        setCountdown('Starting soon!');
        return;
      }
      if (within1h) {
        const mins = Math.floor(minsUntil);
        const secs = Math.floor((minsUntil % 1) * 60);
        setCountdown(`in ${mins} mins ${secs} secs`);
        return;
      }
      const hrs = Math.floor(hrsUntil);
      const mins = Math.floor((hrsUntil % 1) * 60);
      setCountdown(`in ${hrs} hrs ${mins} mins`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [nextBooking, serverTimeOffset, onRefresh]);

  // Carousel auto-advance (only when within 24h)
  useEffect(() => {
    if (!hasBooking || !within24h) return;
    const duration = carouselSlide === 0 ? 3000 : 4000;
    const t = setTimeout(() => setCarouselSlide(prev => (prev + 1) % 2), duration);
    return () => clearTimeout(t);
  }, [hasBooking, within24h, carouselSlide]);

  if (loading) {
    return (
      <div className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl sm:rounded-2xl border border-gray-200 animate-pulse">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-300 rounded-xl sm:rounded-2xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-4 bg-gray-300 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-48" />
        </div>
      </div>
    );
  }

  // ━━━ SCENARIO B — No booking: plain card
  if (!hasBooking) {
    return (
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left bg-gradient-to-r hover:from-white hover:to-gray-50 rounded-xl sm:rounded-2xl border border-gray-200 hover:border-[#11CCEF]/30 transform hover:scale-[1.02] sm:hover:scale-105 transition-all duration-300 group cursor-pointer"
      >
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-base sm:text-lg shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
          📹
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 group-hover:text-[#11CCEF] transition-colors text-sm sm:text-base">
            Book Consultation
          </div>
          <div className="text-xs sm:text-sm text-gray-500">Schedule a video call with your tutor</div>
        </div>
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#11CCEF] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  // ━━━ SCENARIO C — Booking > 24hrs away: plain card + next session
  if (!within24h) {
    return (
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left bg-gradient-to-r hover:from-white hover:to-gray-50 rounded-xl sm:rounded-2xl border border-gray-200 hover:border-[#11CCEF]/30 transform hover:scale-[1.02] sm:hover:scale-105 transition-all duration-300 group cursor-pointer"
      >
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-base sm:text-lg shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
          📹
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 group-hover:text-[#11CCEF] transition-colors text-sm sm:text-base">
            Book Consultation
          </div>
          <div className="text-xs sm:text-sm text-gray-500">Schedule a video call with your tutor</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1 font-medium">
            Next session: {formatDateShort(nextBooking.date)} at {formatTimeAMPM(nextBooking.start_time)}
          </div>
        </div>
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#11CCEF] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const delta = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) setCarouselSlide(delta > 0 ? 1 : 0);
    setTouchStartX(null);
  };

  // ━━━ SCENARIO A — Booking within 24h: carousel
  return (
    <div
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`w-full rounded-xl sm:rounded-2xl border overflow-hidden cursor-pointer transform hover:scale-[1.02] sm:hover:scale-105 transition-all duration-300 group ${
        within15min ? 'border-green-400 animate-pulse shadow-lg shadow-green-200/50' : 'border-orange-300 ring-2 ring-orange-200'
      }`}
    >
      <div className="relative w-full">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${carouselSlide * 100}%)` }}
        >
          {/* SLIDE 1 — Alert */}
          <div className="flex-shrink-0 w-full flex flex-col items-center justify-center px-3 py-2.5 sm:px-4 sm:py-3 bg-gradient-to-r from-orange-400 via-amber-500 to-purple-600 text-white min-h-[72px]">
            <div className="animate-phone-ring text-2xl sm:text-3xl">📞</div>
            <div className="font-black text-sm sm:text-base">Today is Your Call!</div>
            <div className="text-xs text-white/90">with your tutor</div>
          </div>

          {/* SLIDE 2 — Details */}
          <div className="flex-shrink-0 w-full flex flex-col justify-center px-3 py-2.5 sm:px-4 sm:py-3 bg-gradient-to-r from-white to-gray-50 border-l border-gray-100 min-h-[72px]">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-base sm:text-lg shadow-lg flex-shrink-0">
                📹
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm text-gray-600">Your next session:</div>
                <div className="font-bold text-gray-900 text-sm sm:text-base mt-0.5">
                  {formatDateShort(nextBooking.date)} at {formatTimeAMPM(nextBooking.start_time)}
                </div>
                {countdown && (
                  <div className={`text-sm font-bold mt-1 ${within1h ? 'text-red-600' : 'text-orange-600'}`}>
                    {within15min ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        {countdown}
                      </span>
                    ) : (
                      countdown
                    )}
                  </div>
                )}
              </div>
            </div>
            {within15min && nextBooking?.zoom_join_url && (
              <a
                href={nextBooking.zoom_join_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="mt-1.5 block w-full px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold text-center animate-slide-in"
              >
                Join Zoom Meeting
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 py-1 px-3 bg-white/80 border-t border-gray-100">
        {[0, 1].map(i => (
          <button
            key={i}
            onClick={e => {
              e.stopPropagation();
              setCarouselSlide(i);
            }}
            className={`w-2 h-2 rounded-full transition-all ${
              carouselSlide === i ? 'bg-[#11CCEF] scale-125' : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
