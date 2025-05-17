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
  const [scroll, setScroll] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScroll(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Fonction utilitaire pour randomiser la position verticale
  const getRandomTop = (index: number) => {
    const tops = ['top-1/3', 'top-2/3', 'top-1/2', 'top-1/4', 'top-3/4'];
    return tops[index % tops.length];
  };

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

  // Génère le bloc rectangle avec logos décoratifs
  const DecoratedBlock = ({ children, index, whiteBg = false }: { children: React.ReactNode, index: number, whiteBg?: boolean }) => (
    <div className="relative w-full max-w-2xl mx-auto mb-8">
      {/* Frame gauche */}
      <img
        src="/Frame.svg"
        alt="Frame décoratif"
        className={`hidden md:block absolute -left-32 ${getRandomTop(index)} w-12 h-12 md:w-16 md:h-16 z-30`}
        style={{ pointerEvents: 'none', transform: `rotate(${(scroll + index * 30) / 2}deg)` }}
      />
      {/* Frame droite */}
      <img
        src="/Frame.svg"
        alt="Frame décoratif"
        className={`hidden md:block absolute -right-40 ${getRandomTop(index + 1)} w-12 h-12 md:w-16 md:h-16 z-30`}
        style={{ pointerEvents: 'none', transform: `rotate(${(-scroll - index * 30) / 2}deg)` }}
      />
      <div className="w-full h-full absolute inset-0 bg-gray-900 rounded-xl translate-y-2 translate-x-2"></div>
      <div className={`rounded-xl relative z-20 pl-6 sm:pl-8 md:pl-10 pr-6 sm:pr-8 md:pr-16 py-6 md:py-8 border-[3px] border-gray-900 ${whiteBg ? 'bg-white' : 'bg-blue-200'}`}>
        {children}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-16 px-2 sm:px-4 md:px-8">
      <h1 className="text-3xl font-bold mb-2 text-center">Website Compliance Analysis</h1>
      {url && (
        <p className="text-lg mb-8 text-center">
          Analyzing: <span className="font-medium">{url}</span>
        </p>
      )}

      {isLoading ? (
        <DecoratedBlock index={0}>
          <h2 className="text-xl font-semibold mb-4">Analysis in Progress</h2>
          <div className="mb-4">
            <ProgressBar progress={progress} />
          </div>
          <p className="mt-4 text-center text-gray-700">
            {progress < 30 && "Scraping website content..."}
            {progress >= 30 && progress < 60 && "Analyzing Terms of Service..."}
            {progress >= 60 && progress < 90 && "Checking Privacy Policy..."}
            {progress >= 90 && "Finalizing compliance report..."}
          </p>
        </DecoratedBlock>
      ) : results ? (
        <>
          <DecoratedBlock index={1} >
            <OverallScore score={results.overallScore} />
          </DecoratedBlock>

          {results.sections.termsOfService && (
            <DecoratedBlock index={2}>
              <SectionResults 
                section={results.sections.termsOfService} 
                title="Terms of Service"
              />
            </DecoratedBlock>
          )}
          {results.sections.privacyPolicy && (
            <DecoratedBlock index={3}>
              <SectionResults 
                section={results.sections.privacyPolicy} 
                title="Privacy Policy"
              />
            </DecoratedBlock>
          )}
          {results.sections.cookiePolicy && (
            <DecoratedBlock index={4}>
              <SectionResults 
                section={results.sections.cookiePolicy} 
                title="Cookie Policy"
              />
            </DecoratedBlock>
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