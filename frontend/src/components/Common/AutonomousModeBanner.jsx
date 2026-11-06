import React from 'react';

const AutonomousModeBanner = () => {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2z" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-blue-700">
            System is running in autonomous mode.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AutonomousModeBanner;