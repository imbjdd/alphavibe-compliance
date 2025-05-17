'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export default function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      console.error('Error caught by error boundary:', event.error);
      setError(event.error?.message || 'An unknown error occurred');
      setHasError(true);
      event.preventDefault();
    };

    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
        <h2 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h2>
        
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-6 max-w-2xl">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
        
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          We apologize for the inconvenience. Please try refreshing the page or start a new analysis.
        </p>
        
        <div className="flex gap-4">
          <button 
            onClick={() => {
              setHasError(false);
              setError(null);
              window.location.reload();
            }}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Refresh Page
          </button>
          
          <Link
            href="/"
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 