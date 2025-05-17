import { AnalysisResult } from '@/types';
import axios from 'axios';

// Main analysis function - uses API route to avoid client-side Playwright issues
export const analyzeWebsite = async (url: string): Promise<AnalysisResult> => {
  try {
    // Simulate loading delay for demo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Call the API route instead of directly using Playwright
    const response = await axios.post('/api/analyze', { url });
    
    // Return the analysis results with type assertion
    return response.data as AnalysisResult;
  } catch (error) {
    console.error('Error analyzing website:', error);
    throw new Error('Failed to analyze website');
  }
};