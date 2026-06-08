'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';

interface VerificationCountdownProps {
  verificationRequestedAt: string;
}

export default function VerificationCountdown({ verificationRequestedAt }: VerificationCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const requestedTime = new Date(verificationRequestedAt).getTime();
      const now = new Date().getTime();
      const targetTime = requestedTime + (24 * 60 * 60 * 1000); // 24 hours from request
      
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeRemaining('Verification in progress');
        setPercentage(100);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      
      // Calculate percentage (time passed out of 24 hours)
      const totalTime = 24 * 60 * 60 * 1000;
      const timePassed = totalTime - diff;
      const percent = (timePassed / totalTime) * 100;
      setPercentage(Math.min(percent, 100));
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [verificationRequestedAt]);

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-40 h-40">
          {/* Circular progress */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="#e5e7eb"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="#11CCEF"
              strokeWidth="10"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 70}`}
              strokeDashoffset={`${2 * Math.PI * 70 * (1 - percentage / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Clock className="w-10 h-10 text-[#11CCEF] mb-2" />
            <div className="text-2xl font-bold text-gray-900">{Math.round(percentage)}%</div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Verification in Progress</h3>
        <p className="text-gray-600 mb-4">
          Estimated completion time: <span className="font-semibold text-[#11CCEF]">{timeRemaining}</span>
        </p>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
          <div
            className="bg-gradient-to-r from-[#11CCEF] to-[#0daed9] h-3 rounded-full transition-all duration-1000"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        {/* Status message */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span>Our admin team is reviewing your documents</span>
        </div>
      </div>
    </div>
  );
}
