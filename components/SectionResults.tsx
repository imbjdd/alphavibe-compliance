import React from 'react';
import { SectionAnalysis } from '@/types';

interface SectionResultsProps {
  section: SectionAnalysis;
  title: string;
}

const SectionResults: React.FC<SectionResultsProps> = ({ section, title }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex items-center">
          <span className="text-lg font-bold mr-2">{section.score}%</span>
          {section.compliant ? (
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300">
              ✅ Compliant
            </span>
          ) : (
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-red-900 dark:text-red-300">
              ❌ Not Compliant
            </span>
          )}
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md text-sm overflow-auto max-h-60">
        <pre className="whitespace-pre-wrap font-mono text-xs">
          {section.sectionText}
        </pre>
      </div>

      {section.issues.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Issues Found</h3>
          <ul className="space-y-4">
            {section.issues.map((issue) => (
              <li key={issue.ruleId} className="border-l-4 border-red-500 pl-4 py-2">
                <h4 className="font-medium">
                  {issue.ruleName}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    issue.severity === 'high' 
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' 
                      : issue.severity === 'medium'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                  }`}>
                    {issue.severity}
                  </span>
                </h4>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{issue.description}</p>
                <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">
                  <strong>Recommendation:</strong> {issue.recommendation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SectionResults; 