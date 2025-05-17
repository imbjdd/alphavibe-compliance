'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { analyzeWebsite } from '@/services/analyzeService';
import { AnalysisResult } from '@/types';
import ProgressBar from '@/components/ProgressBar';
import SectionResults from '@/components/SectionResults';
import OverallScore from '@/components/OverallScore';

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get('url');
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [results, setResults] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    if (!url) {
      setError('No URL provided');
      setIsLoading(false);
      return;
    }

    const fetchAnalysis = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 1000);
        
        // Analyze website
        const data = await analyzeWebsite(url);
        
        clearInterval(progressInterval);
        setProgress(100);
        setResults(data);
      } catch (e) {
        setError(`Error analyzing website: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
  }, [url]);

  if (error) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-500 mb-4">Error</h1>
        <p className="mb-8">{error}</p>
        <Link 
          href="/"
          className="px-6 py-3 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Try Again
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <h1 className="text-3xl font-bold mb-2">Website Compliance Analysis</h1>
      {url && (
        <p className="text-lg mb-8">
          Analyzing: <span className="font-medium">{url}</span>
        </p>
      )}

      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-xl font-semibold mb-4">Analysis in Progress</h2>
          <ProgressBar progress={progress} />
          <p className="mt-4 text-center text-gray-500">
            {progress < 30 && "Scraping website content..."}
            {progress >= 30 && progress < 60 && "Analyzing Terms of Service..."}
            {progress >= 60 && progress < 90 && "Checking Privacy Policy..."}
            {progress >= 90 && "Finalizing compliance report..."}
          </p>
        </div>
      ) : results ? (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
            <OverallScore score={results.overallScore} />
          </div>

          {results.sections.termsOfService && (
            <SectionResults 
              section={results.sections.termsOfService} 
              title="Terms of Service"
            />
          )}
          
          {results.sections.privacyPolicy && (
            <SectionResults 
              section={results.sections.privacyPolicy} 
              title="Privacy Policy"
            />
          )}
          
          {results.sections.cookiePolicy && (
            <SectionResults 
              section={results.sections.cookiePolicy} 
              title="Cookie Policy"
            />
          )}
          
          <div className="mt-12 text-center">
            <Link 
              href="/"
              className="px-6 py-3 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              New Analysis
            </Link>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p>No results available</p>
        </div>
      )}
    </div>
  );
} 