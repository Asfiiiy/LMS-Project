'use client';

import { CheckCircle, Circle } from 'lucide-react';

interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export default function StepProgress({ currentStep, totalSteps, steps }: StepProgressProps) {
  return (
    <div className="mb-8">
      <div className="relative">
        <div className="absolute top-5 left-0 w-full h-1 bg-gray-200 rounded-full"></div>
        <div 
          className="absolute top-5 left-0 h-1 bg-[#11CCEF] rounded-full transition-all duration-500"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        ></div>
        
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            
            return (
              <div key={index} className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                  transition-all duration-300 border-2
                  ${isCompleted ? 'bg-[#11CCEF] border-[#11CCEF] text-white' : 
                    isCurrent ? 'bg-white border-[#11CCEF] text-[#11CCEF] ring-4 ring-[#11CCEF]/20' : 
                    'bg-white border-gray-300 text-gray-400'}
                `}>
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>
                <span className={`
                  mt-2 text-xs font-medium text-center max-w-[80px]
                  ${isCurrent ? 'text-[#11CCEF]' : isCompleted ? 'text-gray-700' : 'text-gray-400'}
                `}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
