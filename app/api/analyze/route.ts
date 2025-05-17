import { NextResponse } from 'next/server';
import { scrapeWebsite } from '@/services/scrapingService';
import { AnalysisResult, ComplianceIssue } from '@/types';

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

    // Use real scraping with Playwright
    const scrapedData = await scrapeWebsite(url);
    
    // Generate analysis results based on the scraped data
    const termsOfService = scrapedData.termsOfService || '';
    const privacyPolicy = scrapedData.privacyPolicy || '';
    const cookiePolicy = scrapedData.cookiePolicy || '';
    
    // Calculate scores based on content analysis (simplified implementation)
    const tosScore = analyzeCompliance(termsOfService, 'mentions');
    const privacyScore = analyzeCompliance(privacyPolicy, 'privacy');
    const cookieScore = analyzeCompliance(cookiePolicy, 'cookie');
    
    // Calculate overall score
    const overallScore = Math.round((tosScore + privacyScore + cookieScore) / 3);
    
    // Create the analysis result
    const result: AnalysisResult = {
      url,
      timestamp: new Date().toISOString(),
      overallScore,
      sections: {}
    };
    
    // Add sections if they exist
    if (termsOfService) {
      result.sections.termsOfService = {
        sectionName: 'Terms of Service',
        sectionText: termsOfService,
        compliant: tosScore >= 80,
        score: tosScore,
        issues: generateIssues(termsOfService, 'Terms of Service')
      };
    }
    
    if (privacyPolicy) {
      result.sections.privacyPolicy = {
        sectionName: 'Privacy Policy',
        sectionText: privacyPolicy,
        compliant: privacyScore >= 80,
        score: privacyScore,
        issues: generateIssues(privacyPolicy, 'Privacy Policy')
      };
    }
    
    if (cookiePolicy) {
      result.sections.cookiePolicy = {
        sectionName: 'Cookie Policy',
        sectionText: cookiePolicy,
        compliant: cookieScore >= 80,
        score: cookieScore,
        issues: generateIssues(cookiePolicy, 'Cookie Policy')
      };
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze website', details: String(error) },
      { status: 500 }
    );
  }
}

// Analyze compliance based on content
function analyzeCompliance(text: string, type: 'mentions' | 'terms' | 'privacy' | 'cookie'): number {
  if (!text) return 0;
  
  let score = 70; // Base score
  
  // Check for key terms based on document type
  if (type === 'mentions') {
    if (text.toLowerCase().includes('acceptance')) score += 5;
    if (text.toLowerCase().includes('use license')) score += 5;
    if (text.toLowerCase().includes('liability')) score += 5;
    if (text.toLowerCase().includes('terminate')) score += 5;
    if (text.toLowerCase().includes('intellectual property')) score += 5;
  } else if (type === 'privacy') {
    if (text.toLowerCase().includes('personal data')) score += 5;
    if (text.toLowerCase().includes('processing')) score += 5;
    if (text.toLowerCase().includes('data controller')) score += 5;
    if (text.toLowerCase().includes('rights')) score += 5;
    if (text.toLowerCase().includes('consent')) score += 5;
  } else if (type === 'cookie') {
    if (text.toLowerCase().includes('necessary cookies')) score += 5;
    if (text.toLowerCase().includes('preferences')) score += 5;
    if (text.toLowerCase().includes('analytics')) score += 5;
    if (text.toLowerCase().includes('marketing')) score += 5;
    if (text.toLowerCase().includes('consent')) score += 5;
  }
  
  // Cap the score at 100
  return Math.min(score, 100);
}

// Generate real issues based on content analysis
function generateIssues(text: string, sectionType: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const lowerText = text.toLowerCase();
  
  // Check for common compliance issues
  if (sectionType === 'Terms of Service') {
    if (!lowerText.includes('liability') || !lowerText.includes('limitation')) {
      issues.push({
        ruleId: 'terms-1',
        ruleName: 'Liability Limitation',
        severity: 'high',
        description: 'The Terms of Service lacks a proper liability limitation clause',
        recommendation: 'Add a clear liability limitation clause to protect your business'
      });
    }
    
    if (!lowerText.includes('intellectual property') && !lowerText.includes('copyright')) {
      issues.push({
        ruleId: 'terms-2',
        ruleName: 'Intellectual Property Rights',
        severity: 'medium',
        description: 'No clear statement about intellectual property rights',
        recommendation: 'Include a section explaining intellectual property ownership and rights'
      });
    }
  } 
  
  if (sectionType === 'Privacy Policy') {
    if (!lowerText.includes('gdpr') && !lowerText.includes('general data protection')) {
      issues.push({
        ruleId: 'gdpr-1',
        ruleName: 'GDPR Compliance',
        severity: 'high',
        description: 'No explicit mention of GDPR compliance',
        recommendation: 'Include a section explaining how you comply with GDPR requirements'
      });
    }
    
    if (!lowerText.includes('data subject') && !lowerText.includes('rights')) {
      issues.push({
        ruleId: 'gdpr-3',
        ruleName: 'Data Subject Rights',
        severity: 'high',
        description: 'The Privacy Policy does not adequately explain data subject rights',
        recommendation: 'Add a section detailing all data subject rights under applicable laws'
      });
    }
  }
  
  if (sectionType === 'Cookie Policy') {
    if (!lowerText.includes('necessary') || !lowerText.includes('essential')) {
      issues.push({
        ruleId: 'cookie-1',
        ruleName: 'Cookie Categories',
        severity: 'medium',
        description: 'Cookie policy does not clearly categorize cookies by purpose',
        recommendation: 'Clearly categorize cookies (necessary, preferences, statistics, marketing)'
      });
    }
    
    if (!lowerText.includes('opt-out') && !lowerText.includes('opt out') && !lowerText.includes('disable')) {
      issues.push({
        ruleId: 'cookie-2',
        ruleName: 'Opt-Out Mechanism',
        severity: 'high',
        description: 'No clear explanation of how users can opt out of non-essential cookies',
        recommendation: 'Add instructions for opting out of or disabling non-essential cookies'
      });
    }
  }
  
  return issues;
} 