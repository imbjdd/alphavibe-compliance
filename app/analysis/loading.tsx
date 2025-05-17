import React from 'react';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto pb-16">
      <h1 className="text-3xl font-bold mb-2">Website Compliance Analysis</h1>
      <p className="text-lg mb-8">Loading analysis...</p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 animate-pulse">Preparing Analysis...</h2>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-full overflow-hidden">
          <div className="h-full bg-primary animate-pulse" style={{ width: '30%' }}></div>
        </div>
        <p className="mt-4 text-center text-gray-500">
          Getting ready to analyze compliance...
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8 animate-pulse">
        <div className="flex flex-col items-center">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-full w-48 mb-4"></div>
          <div className="relative w-48 h-48 mx-auto mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full bg-gray-200 dark:bg-gray-700 opacity-40"></div>
            </div>
          </div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-72"></div>
        </div>
      </div>
    </div>
  );
} 