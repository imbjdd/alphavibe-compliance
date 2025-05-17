// Compliance Rule Types
export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: 'gdpr' | 'eprivacy' | 'cookie' | 'accessibility';
  criteria: string[];
}

// Compliance Check Result Types
export interface ComplianceIssue {
  ruleId: string;
  ruleName: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

export interface SectionAnalysis {
  sectionName: string;
  sectionText: string;
  compliant: boolean;
  score: number; // 0-100
  issues: ComplianceIssue[];
}

export interface AnalysisResult {
  url: string;
  timestamp: string;
  overallScore: number; // 0-100
  sections: {
    termsOfService?: SectionAnalysis;
    privacyPolicy?: SectionAnalysis;
    cookiePolicy?: SectionAnalysis;
  };
} 