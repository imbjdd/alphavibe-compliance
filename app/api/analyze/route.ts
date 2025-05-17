import { NextResponse } from 'next/server';
import { scrapeWebsite } from '@/services/scrapingService';
import { AnalysisResult, ComplianceIssue } from '@/types';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface OpenAIMessage {
  role: string;
  content: string;
}

interface OpenAIChoice {
  message: OpenAIMessage;
  index: number;
  finish_reason: string;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Function to call OpenAI API with retry logic
async function callOpenAIWithRetry(messages: {role: string, content: string}[], model = 'gpt-3.5-turbo', maxTokens = 1000, retries = 2): Promise<OpenAIResponse> {
  let retryCount = 0;
  let lastError: any;
  
  while (retryCount <= retries) {
    try {
      if (retryCount > 0) {
        // Shorter backoff time to improve performance
        const backoffTime = Math.min(Math.pow(2, retryCount) * 1000, 4000);
        console.log(`Retrying in ${backoffTime/1000} seconds (attempt ${retryCount} of ${retries})...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model,
          messages,
          temperature: 0.1,
          max_tokens: maxTokens,
          presence_penalty: 0,
          frequency_penalty: 0
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 seconds timeout
        }
      );
      
      return response.data as OpenAIResponse;
    } catch (error: any) {
      lastError = error;
      
      // Handle rate limits
      if (error.response && error.response.status === 429) {
        retryCount++;
        
        if (retryCount > retries) {
          console.error('Rate limit error persisted after multiple retries. Giving up.');
          break;
        }
        
        continue;
      } else {
        // For any other type of error, throw immediately
        throw error;
      }
    }
  }
  
  // If we got here, we've exhausted our retries
  throw lastError;
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }
    
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not found. Please add OPENAI_API_KEY to your .env file.' },
        { status: 500 }
      );
    }

    // Use real scraping with Playwright
    const scrapedData = await scrapeWebsite(url);
    
    // Get the document texts
    const termsOfService = scrapedData.termsOfService || '';
    const privacyPolicy = scrapedData.privacyPolicy || '';
    const cookiePolicy = scrapedData.cookiePolicy || '';
    
    // Create the analysis result
    const result: AnalysisResult = {
      url,
      timestamp: new Date().toISOString(),
      overallScore: 0, // Will be calculated based on section scores
      sections: {}
    };
    
    // Analyze documents using OpenAI
    if (termsOfService) {
      const tosAnalysis = await analyzeContentWithOpenAI(termsOfService, 'Terms of Service');
      result.sections.termsOfService = {
        sectionName: 'Terms of Service',
        sectionText: termsOfService,
        compliant: tosAnalysis.score >= 80,
        score: tosAnalysis.score,
        issues: tosAnalysis.issues
      };
    }
    
    if (privacyPolicy) {
      const privacyAnalysis = await analyzeContentWithOpenAI(privacyPolicy, 'Privacy Policy');
      result.sections.privacyPolicy = {
        sectionName: 'Privacy Policy',
        sectionText: privacyPolicy,
        compliant: privacyAnalysis.score >= 80,
        score: privacyAnalysis.score,
        issues: privacyAnalysis.issues
      };
    }
    
    if (cookiePolicy) {
      const cookieAnalysis = await analyzeContentWithOpenAI(cookiePolicy, 'Cookie Policy');
      result.sections.cookiePolicy = {
        sectionName: 'Cookie Policy',
        sectionText: cookiePolicy,
        compliant: cookieAnalysis.score >= 80,
        score: cookieAnalysis.score,
        issues: cookieAnalysis.issues
      };
    }
    
    // Calculate overall score as average of section scores
    const scores: number[] = [];
    if (result.sections.termsOfService) scores.push(result.sections.termsOfService.score);
    if (result.sections.privacyPolicy) scores.push(result.sections.privacyPolicy.score);
    if (result.sections.cookiePolicy) scores.push(result.sections.cookiePolicy.score);
    
    // Calculate average or default to 0 if no scores
    result.overallScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze website', details: String(error) },
      { status: 500 }
    );
  }
}

// Analyze compliance using OpenAI
async function analyzeContentWithOpenAI(text: string, documentType: string): Promise<{ score: number, issues: ComplianceIssue[] }> {
  // Truncate text more aggressively to reduce token usage and processing time
  const truncatedText = text.length > 6000 ? text.substring(0, 6000) + '...[truncated]' : text;
  
  let prompt = '';
  let systemPrompt = '';
  
  if (documentType === 'Terms of Service') {
    systemPrompt = `Analyze the provided Terms of Service for legal compliance and return JSON only.`;
    
    prompt = `Analyze the terms of service briefly for key compliance issues only.

Key areas: clear language, liability, IP rights, termination, governing law.

Return JSON only:
{
  "score": [0-100 compliance score],
  "issues": [
    {
      "ruleId": "issue-id",
      "ruleName": "Issue name",
      "severity": "high/medium/low",
      "description": "Brief issue description",
      "recommendation": "Brief recommendation"
    }
  ]
}

Terms:
${truncatedText}`;
  } else if (documentType === 'Privacy Policy') {
    systemPrompt = `Analyze the provided Privacy Policy for compliance issues and return JSON only.`;
    
    prompt = `Analyze the privacy policy briefly for key compliance issues only.

Key areas: data purpose, data rights, legal basis, retention, sharing.

Return JSON only:
{
  "score": [0-100 compliance score],
  "issues": [
    {
      "ruleId": "issue-id",
      "ruleName": "Issue name",
      "severity": "high/medium/low",
      "description": "Brief issue description", 
      "recommendation": "Brief recommendation"
    }
  ]
}

Policy:
${truncatedText}`;
  } else if (documentType === 'Cookie Policy') {
    systemPrompt = `Analyze the provided Cookie Policy for compliance issues and return JSON only.`;
    
    prompt = `Analyze the cookie policy briefly for key compliance issues only.

Key areas: cookie types, purposes, duration, third-parties, opt-out options.

Return JSON only:
{
  "score": [0-100 compliance score],
  "issues": [
    {
      "ruleId": "issue-id",
      "ruleName": "Issue name",
      "severity": "high/medium/low",
      "description": "Brief issue description",
      "recommendation": "Brief recommendation"
    }
  ]
}

Policy:
${truncatedText}`;
  }
  
  console.log(`Analyzing ${documentType} with OpenAI...`);
  
  try {
    // Call OpenAI API with retry - use faster model and settings
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];
    
    // Always use gpt-3.5-turbo, limit tokens for faster response
    const response = await callOpenAIWithRetry(messages, 'gpt-3.5-turbo', 1000);
    const content = response.choices[0].message.content;
    
    // Parse the response as JSON
    try {
      // Extract JSON from potential Markdown code blocks
      let jsonContent = content;
      
      // Check if response is wrapped in a Markdown code block
      const markdownPattern = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
      const markdownMatch = content.match(markdownPattern);
      
      if (markdownMatch && markdownMatch[1]) {
        // Extract just the JSON part from the Markdown code block
        jsonContent = markdownMatch[1];
      }
      
      // For other possible formats, try to find the first { and last }
      if (!markdownMatch) {
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonContent = content.substring(firstBrace, lastBrace + 1);
        }
      }
      
      // Now parse the cleaned JSON content
      const analysisResult = JSON.parse(jsonContent);
      
      // Validate and sanitize the response
      const score = typeof analysisResult.score === 'number' ? 
        Math.min(Math.max(Math.round(analysisResult.score), 0), 100) : 70;
      
      const issues: ComplianceIssue[] = Array.isArray(analysisResult.issues) ? 
        analysisResult.issues.slice(0, 10).map((issue: any) => ({
          ruleId: String(issue.ruleId || `${documentType.toLowerCase()}-issue`),
          ruleName: String(issue.ruleName || 'Compliance Issue'),
          severity: ['high', 'medium', 'low'].includes(issue.severity) ? 
            issue.severity as 'high' | 'medium' | 'low' : 'medium',
          description: String(issue.description || 'Compliance issue detected'),
          recommendation: String(issue.recommendation || 'Review and update this section')
        })) : [];
      
      return { score, issues };
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      // Fallback to default values if parsing fails
      return { 
        score: 50, 
        issues: [{ 
          ruleId: `${documentType.toLowerCase()}-parse-error`, 
          ruleName: 'Analysis Error',
          severity: 'medium',
          description: 'Unable to analyze the document properly',
          recommendation: 'Please try again or have a legal expert review this document manually'
        }] 
      };
    }
  } catch (error: any) {
    console.error(`Error analyzing ${documentType}:`, error);
    return {
      score: 40,
      issues: [{
        ruleId: `${documentType.toLowerCase()}-api-error`,
        ruleName: 'Analysis Error',
        severity: 'high',
        description: `Failed to analyze ${documentType}: ${error.message}`,
        recommendation: 'Please try again later or have a legal expert review this document manually'
      }]
    };
  }
} 