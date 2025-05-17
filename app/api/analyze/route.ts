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
async function callOpenAIWithRetry(messages: {role: string, content: string}[], model = 'gpt-4-turbo', maxTokens = 1000, retries = 3): Promise<OpenAIResponse> {
  let retryCount = 0;
  let lastError: any;
  
  while (retryCount <= retries) {
    try {
      if (retryCount > 0) {
        // If this is a retry, wait with exponential backoff
        const backoffTime = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying in ${backoffTime/1000} seconds (attempt ${retryCount} of ${retries})...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model,
          messages,
          temperature: 0.1,
          max_tokens: maxTokens
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
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
  // Truncate text to fit within token limits
  const truncatedText = text.length > 12000 ? text.substring(0, 12000) + '...[truncated]' : text;
  
  let prompt = '';
  let systemPrompt = '';
  
  if (documentType === 'Terms of Service') {
    systemPrompt = `You are a legal expert specializing in Terms of Service compliance. Analyze the provided Terms of Service for legal compliance and best practices. Return your response as a JSON object without any markdown formatting.`;
    
    prompt = `Analyze this Terms of Service for compliance with best practices and legal requirements.

Important areas to check:
1. Clear and understandable language
2. Liability limitations
3. Intellectual property rights
4. Termination clauses
5. Governing law and jurisdiction
6. User obligations and restrictions
7. Changes to terms notification
8. Account termination policy

Provide your response in the following structured JSON format only, without any markdown formatting or code blocks:
{
  "score": [0-100 score representing overall compliance],
  "issues": [
    {
      "ruleId": "unique-id-for-issue",
      "ruleName": "Short name of the compliance rule",
      "severity": "high/medium/low",
      "description": "Description of the issue found",
      "recommendation": "Specific recommendation to fix the issue"
    }
  ]
}

Terms of Service:
${truncatedText}`;
  } else if (documentType === 'Privacy Policy') {
    systemPrompt = `You are a legal expert specializing in privacy laws including GDPR, CCPA, and other privacy regulations. Analyze the provided Privacy Policy for compliance issues. Return your response as a JSON object without any markdown formatting.`;
    
    prompt = `Analyze this Privacy Policy for compliance with GDPR, CCPA, and general privacy best practices.

Important areas to check:
1. Purpose of data collection
2. Types of data collected
3. Data subject rights (access, deletion, portability)
4. Legal basis for processing
5. Data retention policies
6. Third-party sharing
7. International transfers
8. Security measures
9. Cookie usage disclosure
10. Changes to privacy policy notification

Provide your response in the following structured JSON format only, without any markdown formatting or code blocks:
{
  "score": [0-100 score representing overall compliance],
  "issues": [
    {
      "ruleId": "unique-id-for-issue",
      "ruleName": "Short name of the compliance rule",
      "severity": "high/medium/low",
      "description": "Description of the issue found",
      "recommendation": "Specific recommendation to fix the issue"
    }
  ]
}

Privacy Policy:
${truncatedText}`;
  } else if (documentType === 'Cookie Policy') {
    systemPrompt = `You are a legal expert specializing in cookie policies and ePrivacy regulations. Analyze the provided Cookie Policy for compliance issues. Return your response as a JSON object without any markdown formatting.`;
    
    prompt = `Analyze this Cookie Policy for compliance with ePrivacy Directive, GDPR, and cookie best practices.

Important areas to check:
1. Classification of cookies (necessary, preferences, analytics, marketing)
2. Purpose of each cookie type
3. Duration of cookies
4. Third-party cookies disclosure
5. Opt-out mechanisms
6. Consent requirements
7. Clear explanations of tracking technologies
8. Information about disabling cookies

Provide your response in the following structured JSON format only, without any markdown formatting or code blocks:
{
  "score": [0-100 score representing overall compliance],
  "issues": [
    {
      "ruleId": "unique-id-for-issue",
      "ruleName": "Short name of the compliance rule",
      "severity": "high/medium/low", 
      "description": "Description of the issue found",
      "recommendation": "Specific recommendation to fix the issue"
    }
  ]
}

Cookie Policy:
${truncatedText}`;
  }
  
  console.log(`Analyzing ${documentType} with OpenAI...`);
  
  try {
    // Call OpenAI API with retry
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];
    
    // Use gpt-3.5-turbo for faster response and lower cost
    const response = await callOpenAIWithRetry(messages, 'gpt-3.5-turbo', 2000);
    const content = response.choices[0].message.content;
    
    // Log response for debugging
    console.log(`\n========== OPENAI ANALYSIS FOR ${documentType} ==========`);
    console.log(`Model used: ${response.model}`);
    console.log(`Tokens used: ${response.usage.total_tokens}`);
    console.log(`Response: ${content}`);
    console.log(`========== END OPENAI ANALYSIS ==========\n`);
    
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