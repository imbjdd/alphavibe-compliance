'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Simple URL validation
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        setError('URL must start with http:// or https://');
        return;
      }
      
      // Navigate to analysis page
      router.push(`/analysis?url=${encodeURIComponent(url)}`);
    } catch (e) {
      setError('Please enter a valid URL');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold mb-4">EU Compliance Checker</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
          Analyze your website's compliance with European laws including GDPR, e-Privacy, and more.
        </p>
      </div>

      <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Website URL
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <input
                type="text"
                id="url"
                className={`block w-full px-4 py-3 border ${error ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:ring-primary focus:border-primary`}
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Analyze Compliance
          </button>
        </form>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          Our tool checks websites against GDPR, e-Privacy, and other EU regulations
        </p>
        <div className="text-xs px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md inline-block">
          <span className="font-semibold">Demo Mode:</span> This application uses simulated data for demonstration purposes
        </div>
      </div>
    </div>
  );
} 