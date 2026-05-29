import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  message?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, message }) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full bg-gray-700 rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-300">
          {message || 'Processing emails...'}
        </span>
        <span className="text-sm font-medium text-blue-400">
          {current} / {total} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-gray-600 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        >
          <div className="h-full w-full bg-white opacity-20 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
