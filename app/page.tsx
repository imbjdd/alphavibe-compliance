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
    <>
      <div className="background-gradient" />
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8 md:py-12 lg:py-16 gap-6 md:gap-8 lg:gap-10 relative z-10 container mx-auto">
        <div className="text-center max-w-2xl md:max-w-3xl lg:max-w-4xl relative">
          {/* Étoile à gauche du titre */}
          <img
            src="/Frame.svg"
            alt="Frame décoratif"
            className="hidden md:block absolute -left-14 sm:-left-16 md:-left-20 lg:-left-24 top-1/2 -translate-y-4/3 -rotate-15 w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 z-20"
            style={{ pointerEvents: 'none' }}
          />
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 lg:mb-6">EU Compliance Checker</h1>
          
          {/* Étoile à droite du titre */}
          <img
            src="/Frame.svg"
            alt="Frame décoratif"
            className="hidden md:block absolute -right-14 sm:-right-16 md:-right-20 lg:-right-24 top-1/2 translate-y-1/3 rotate-15 w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 z-20"
            style={{ pointerEvents: 'none' }}
          />
          
          <p className="text-lg md:text-xl lg:text-2xl text-gray-600 dark:text-gray-300 mb-6 md:mb-8 lg:mb-10 max-w-prose mx-auto">
            Analyze your website's compliance with European laws including GDPR, e-Privacy, and more.
          </p>
        </div>
        <div className="relative w-full flex items-center justify-center px-4 sm:px-6 md:px-8">
          {/* Rectangle du formulaire */}
          <div className="relative w-full max-w-xl md:max-w-2xl lg:max-w-3xl z-20">
            <div className="w-full h-full absolute inset-0 bg-gray-900 rounded-xl translate-y-2 translate-x-2"></div>
            <div className="rounded-xl relative z-20 pl-6 sm:pl-8 md:pl-10 pr-6 sm:pr-8 md:pr-16 py-6 md:py-8 border-[3px] border-gray-900 bg-blue-200">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="url" className="block text-sm md:text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Website URL
                  </label>
                  <div className="mt-1 relative flex flex-col sm:flex-row gap-3 sm:gap-0">
                    {/* Champ avec effet décalé */}
                    <div className="relative w-full h-full">
                      <div className="w-full h-full rounded bg-gray-900 translate-y-1 translate-x-1 absolute inset-0 z-10"></div>
                      <input
                        type="text"
                        id="url"
                        className={`border-[3px] w-full relative z-20 border-gray-900 placeholder-gray-600 text-base md:text-lg font-medium focus:outline-none py-3 md:py-3.5 px-4 md:px-6 rounded bg-white ${error ? 'border-red-300' : ''}`}
                        placeholder="https://example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                    </div>
                    {/* Bouton avec effet décalé */}
                    <div className="relative w-full sm:w-auto flex-shrink-0 h-full group sm:ml-3">
                      <div className="w-full h-full rounded bg-gray-800 translate-y-1 translate-x-1 absolute inset-0 z-10"></div>
                      <button
                        type="submit"
                        className="py-3 md:py-3.5 rounded px-4 md:px-6 group-hover:-translate-y-px group-hover:-translate-x-px ease-out duration-300 z-20 relative w-full border-[3px] border-gray-900 bg-blue-500 tracking-wide text-base md:text-lg flex-shrink-0 text-white font-bold cursor-pointer"
                      >
                        Analyze Compliance
                      </button>
                    </div>
                  </div>
                  {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      {/* Footer */}
      <footer className="w-full flex items-center justify-center gap-2 py-6 md:py-8 text-text-base font-medium">
        <span>Made with <span className="text-pink-500">💖</span> by Alphavibe</span>
        <a
          href="https://github.com/imbjdd/alphavibe-compliance"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 hover:scale-110 transition-transform"
          title="Voir le repo open source sur GitHub"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.58 2 12.26C2 16.62 4.87 20.26 8.84 21.5C9.34 21.59 9.52 21.32 9.52 21.09C9.52 20.88 9.51 20.3 9.51 19.63C7 20.13 6.48 18.36 6.48 18.36C6.04 17.23 5.37 16.94 5.37 16.94C4.39 16.28 5.45 16.3 5.45 16.3C6.54 16.39 7.09 17.53 7.09 17.53C8.06 19.23 9.68 18.77 10.28 18.54C10.37 17.8 10.66 17.3 10.99 17.03C8.8 16.76 6.5 15.93 6.5 12.77C6.5 11.81 6.84 11.04 7.4 10.43C7.31 10.16 7.01 9.13 7.48 7.77C7.48 7.77 8.2 7.48 9.5 8.38C10.18 8.19 10.92 8.09 11.66 8.09C12.4 8.09 13.14 8.19 13.82 8.38C15.12 7.48 15.84 7.77 15.84 7.77C16.31 9.13 16.01 10.16 15.92 10.43C16.48 11.04 16.82 11.81 16.82 12.77C16.82 15.94 14.51 16.76 12.32 17.03C12.74 17.37 13.11 18.04 13.11 19.03C13.11 20.41 13.1 21.54 13.1 21.09C13.1 21.32 13.28 21.6 13.78 21.5C17.75 20.26 20.62 16.62 20.62 12.26C20.62 6.58 16.14 2 12 2Z" fill="#181717"/>
          </svg>
        </a>
      </footer>
    </>
  );
} 