// Mock scraping service that doesn't depend on Playwright
// This avoids issues with running Playwright in serverless environments

interface ScrapingResult {
  termsOfService: string | null;
  privacyPolicy: string | null;
  cookiePolicy: string | null;
}

/**
 * Mock implementation that just returns sample data
 * This is useful for demos and when Playwright can't be used
 */
export const getMockData = (url: string): ScrapingResult => {
  return {
    termsOfService: `TERMS OF SERVICE FOR ${url}\n\nLast Updated: ${new Date().toLocaleDateString()}\n\n1. ACCEPTANCE OF TERMS\nBy accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.\n\n2. USE LICENSE\nPermission is granted to temporarily download one copy of the materials on this website for personal, non-commercial transitory viewing only.\n\n3. USER ACCOUNT\nIf you register for an account on our website, you are responsible for maintaining the security of your account, and you are fully responsible for all activities that occur under the account.\n\n4. DATA COLLECTION\nWe may collect personal data about you, including but not limited to your email, name, preferences, and browsing behavior. This data is used to improve our service and for personalization.\n\n5. LIMITATION OF LIABILITY\nThe company shall not be liable for any special or consequential damages that result from the use of, or the inability to use, the services and products offered on this website.`,
    
    privacyPolicy: `PRIVACY POLICY FOR ${url}\n\nEffective Date: ${new Date().toLocaleDateString()}\n\nThis Privacy Policy describes how we collect, use, process, and disclose your information, including personal information, in conjunction with your access to and use of our website.\n\n1. INFORMATION WE COLLECT\nWe collect personal information that you provide directly to us, such as your name, email address, payment information, and other information you choose to provide.\n\n2. HOW WE USE YOUR INFORMATION\nWe use the information we collect to provide, maintain, and improve our services, process transactions, send communications, and for other purposes explained in this privacy policy.\n\n3. INFORMATION SHARING AND DISCLOSURE\nWe may share your information with third-party vendors who need access to your information to provide services to us or you. These third parties are bound by strict confidentiality agreements.\n\n4. DATA RETENTION\nWe will retain your personal information for as long as necessary to fulfill the purposes outlined in this privacy policy unless a longer retention period is required or permitted by law.\n\n5. YOUR RIGHTS\nYou have the right to access, correct, update, or request deletion of your personal information. You can object to processing of your personal information, ask us to restrict processing of your personal information or request portability of your personal information.`,
    
    cookiePolicy: `COOKIE POLICY FOR ${url}\n\nLast Updated: ${new Date().toLocaleDateString()}\n\n1. WHAT ARE COOKIES\nCookies are small text files that are placed on your computer or mobile device when you browse websites. They are widely used to make websites work or work more efficiently, as well as to provide information to the owners of the site.\n\n2. HOW WE USE COOKIES\nWe use cookies for various purposes including: understanding and saving user preferences for future visits, compiling aggregate data about site traffic and site interactions, and assisting our marketing partners in aggregating anonymized data about interests.\n\n3. TYPES OF COOKIES WE USE\n- Essential cookies: These are necessary for the website to function properly.\n- Preference cookies: These remember your preferences and settings.\n- Analytics cookies: These help us understand how visitors interact with our website.\n- Marketing cookies: These are used to track visitors across websites to display relevant advertisements.\n\n4. CONTROLLING COOKIES\nYou can control and manage cookies in various ways. You can delete cookies that are already on your computer and you can set most browsers to prevent them from being placed. However, if you do this, you may have to manually adjust some preferences every time you visit a site.`
  };
};

/**
 * Simple mock scraping function that returns example data
 */
export const mockScrapeWebsite = async (url: string): Promise<ScrapingResult> => {
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Return mock data
    return getMockData(url);
  } catch (error) {
    console.error('Error during mock scraping:', error);
    throw new Error('Failed to retrieve website data');
  }
}; 