import React from 'react';

interface OverallScoreProps {
  score: number;
}

const OverallScore: React.FC<OverallScoreProps> = ({ score }) => {
  // Determine color based on score
  const getColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTextColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMessage = (score: number) => {
    if (score >= 80) return 'Good - Your website is largely compliant with EU regulations';
    if (score >= 60) return 'Needs Improvement - Several compliance issues were detected';
    return 'Poor - Major compliance issues detected';
  };

  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-6">Overall Compliance Score</h2>
      
      <div className="relative w-48 h-48 mx-auto mb-8">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-40 h-40 rounded-full ${getColor(score)} opacity-20`}></div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-32 h-32 rounded-full ${getColor(score)} opacity-40`}></div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-4xl font-bold" style={{ color: getColor(score).replace('bg-', '') }}>
            {score}%
          </div>
        </div>
      </div>

      <p className={`text-lg font-medium ${getTextColor(score)}`}>
        {getMessage(score)}
      </p>
    </div>
  );
};

export default OverallScore; 