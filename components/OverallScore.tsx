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
    <div className="relative w-full max-w-xl mx-auto mb-8">
      {/* Carte bleue extérieure */}
     
        {/* Carte blanche intérieure */}
        <div className="bg-white  rounded-lg shadow-lg p-8 px-6 py-6 w-full max-w-xs mx-auto  mt-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Overall Compliance Score</h2>
          <div className="relative w-40 h-40 mx-auto mb-6">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-36 h-36 rounded-full ${getColor(score)} opacity-20`}></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-28 h-28 rounded-full ${getColor(score)} opacity-40`}></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-4xl font-bold" style={{ color: getColor(score).replace('bg-', '') }}>
                {score}%
              </div>
            </div>
          </div>
          <p className={`text-lg font-medium text-center ${getTextColor(score)}`}>{getMessage(score)}</p>
        </div>
      </div>
    
  );
};

export default OverallScore; 