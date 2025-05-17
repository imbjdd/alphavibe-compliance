import { chromium } from 'playwright';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ScrapingResult {
  termsOfService: string | null;
  privacyPolicy: string | null;
  cookiePolicy: string | null;
}

interface Link {
  text: string;
  href: string;
  isFooter?: boolean;
  isHeader?: boolean;
}

interface ComplianceLinks {
  termsLink: Link | null;
  privacyLink: Link | null;
  cookieLink: Link | null;
}

// OpenAI API response types
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

/**
 * Call OpenAI API with retry logic and exponential backoff for rate limiting
 */
async function callOpenAIWithRetry(messages: {role: string, content: string}[], model = 'gpt-4-turbo', maxTokens = 4096, retries = 4): Promise<OpenAIResponse> {
  let retryCount = 0;
  let lastError: unknown;
  
  while (retryCount <= retries) {
    try {
      if (retryCount > 0) {
        // If this is a retry, wait with exponential backoff
        let backoffTime = Math.pow(2, retryCount) * 1000;
        
        // For token rate limits, use a longer base waiting time
        if (lastError && typeof lastError === 'object' && 'response' in lastError && 
            lastError.response && 
            (lastError.response as any).data?.error?.type === 'tokens') {
          // Extract the suggested wait time if available
          const errorMessage = (lastError.response as any).data?.error?.message || '';
          const waitTimeMatch = errorMessage.match(/Please try again in (\d+\.?\d*)s/);
          
          if (waitTimeMatch && waitTimeMatch[1]) {
            // Use the suggested wait time from the API + 5 seconds buffer
            const suggestedWait = parseFloat(waitTimeMatch[1]) * 1000 + 5000;
            backoffTime = Math.max(backoffTime, suggestedWait);
            console.log(`Token limit exceeded, API suggests waiting ${waitTimeMatch[1]}s. Waiting ${backoffTime/1000}s...`);
          } else {
            // Default longer wait for token limits
            backoffTime = Math.max(backoffTime, 30000); // At least 30 seconds for token limits
            console.log(`Token limit exceeded, waiting ${backoffTime/1000} seconds...`);
          }
        } else {
          console.log(`Rate limit hit, retrying in ${backoffTime/1000} seconds (attempt ${retryCount} of ${retries})...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
      
      // Reduce model complexity if we're hitting rate limits repeatedly
      let requestModel = model;
      if (retryCount >= 3 && model.includes('gpt-4')) {
        // Switch to GPT-3.5 after multiple retries to reduce token usage
        requestModel = 'gpt-3.5-turbo';
        console.log('Switching to gpt-3.5-turbo model after multiple rate limit errors');
      }
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: requestModel,
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
    } catch (error: unknown) {
      lastError = error;
      
      // Handle token-specific rate limits
      if (error && typeof error === 'object' && 'response' in error && 
          error.response && 
          ((error.response as any).status === 429 || 
           (error.response as any)?.data?.error?.code === 'rate_limit_exceeded')) {
        
        // This is a rate limit error, retry with backoff
        retryCount++;
        
        // If we're at the last retry, we'll exit the loop and throw the error
        if (retryCount > retries) {
          console.error(`Rate limit error persisted after ${retries} retries. Giving up.`);
          break;
        }
        
        // Extract retry-after header if present
        const retryAfter = (error.response as any).headers && (error.response as any).headers['retry-after'];
        if (retryAfter) {
          const waitTime = parseInt(retryAfter, 10) * 1000;
          console.log(`Rate limit hit, API suggests waiting ${waitTime/1000} seconds. Waiting...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // Otherwise continue to the next iteration (which will apply exponential backoff)
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

/**
 * Uses Playwright to scrape a website for compliance-related content
 */
export const scrapeWebsite = async (url: string): Promise<ScrapingResult> => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error: unknown) {
    console.error('Error launching browser:', error);
    // Try to install Playwright browsers automatically
    try {
      console.log('Attempting to install Playwright browsers...');
      await execAsync('npx playwright install chromium');
      console.log('Playwright browsers installed successfully, retrying...');
      browser = await chromium.launch({ headless: true });
    } catch (installError) {
      console.error('Error installing Playwright browsers:', installError);
      throw new Error(`
Failed to launch browser for scraping. Playwright browsers may not be installed.
Please run the following command manually and try again:
npx playwright install
Error details: ${(error as Error).message || String(error)}`);
    }
  }
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Store links we've found and secondary URLs to explore if needed
    const mainLinks = await findComplianceLinks(page);
    let footerLinks: ComplianceLinks = {
      termsLink: null,
      privacyLink: null,
      cookieLink: null
    };
    let menuLinks: ComplianceLinks = {
      termsLink: null,
      privacyLink: null,
      cookieLink: null
    };
    
    // If we didn't find all the compliance links on the main page, check the footer
    if (!mainLinks.termsLink || !mainLinks.privacyLink || !mainLinks.cookieLink) {
      // Try to find and visit the footer links
      footerLinks = await findFooterLinks(page);
    }
    
    // If still missing links, check common pages like "about", "legal", etc.
    if ((!mainLinks.termsLink && !footerLinks.termsLink) || 
        (!mainLinks.privacyLink && !footerLinks.privacyLink) || 
        (!mainLinks.cookieLink && !footerLinks.cookieLink)) {
      menuLinks = await findMenuLinks(page);
    }
    
    // Consolidate all links (prioritize main page links, then footer, then menu)
    const termsLink = mainLinks.termsLink || footerLinks.termsLink || menuLinks.termsLink;
    const privacyLink = mainLinks.privacyLink || footerLinks.privacyLink || menuLinks.privacyLink;
    const cookieLink = mainLinks.cookieLink || footerLinks.cookieLink || menuLinks.cookieLink;
    
    console.log('Found Terms link:', termsLink?.href);
    console.log('Found Privacy link:', privacyLink?.href);
    console.log('Found Cookie link:', cookieLink?.href);
    
    // Scrape content from identified pages using OpenAI
    // Use gpt-3.5-turbo for all extractions to avoid rate limits
    let termsOfService = null;
    let privacyPolicy = null;
    let cookiePolicy = null;
    
    // Add some delay between API calls to avoid rate limits
    if (termsLink) {
      termsOfService = await scrapePageWithOpenAI(termsLink.href, context, 'terms of service');
      // Add a delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Handle privacy and cookie policies, which might be combined
    if (privacyLink && cookieLink && privacyLink.href === cookieLink.href) {
      // Same URL for both - extract both from same page
      console.log('Privacy and cookie policies appear to be on the same page');
      const combinedContent = await scrapePageForMultiplePolicies(privacyLink.href, context);
      privacyPolicy = combinedContent.privacyPolicy;
      cookiePolicy = combinedContent.cookiePolicy;
    } else {
      // Different URLs or only one exists
      if (privacyLink) {
        privacyPolicy = await scrapePageWithOpenAI(privacyLink.href, context, 'privacy policy');
        // Add a delay between API calls
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      if (cookieLink) {
        cookiePolicy = await scrapePageWithOpenAI(cookieLink.href, context, 'cookie policy');
      } else if (privacyLink && privacyPolicy) {
        // If no dedicated cookie policy link is found, try to extract cookie-related content from privacy policy
        console.log('No dedicated cookie policy found, searching in privacy policy...');
        cookiePolicy = await extractCookiePolicyFromPrivacyPolicy(privacyPolicy);
      }
    }
    
    return {
      termsOfService,
      privacyPolicy,
      cookiePolicy
    };
  } catch (error: unknown) {
    console.error('Error during scraping:', error);
    throw new Error(`Failed to scrape website ${url}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await browser?.close().catch(err => console.error('Error closing browser:', err));
  }
};

/**
 * Find compliance links on the main page
 */
const findComplianceLinks = async (page: any): Promise<ComplianceLinks> => {
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent?.trim().toLowerCase() || '',
      href: a.href,
      isFooter: a.closest('footer') !== null,
      isHeader: a.closest('header') !== null
    }));
  });
  
  // English and French terms for compliance documents
  const termsLink = links.find((link: Link) => 
    link.text.includes('terms') || 
    link.text.includes('conditions') || 
    link.text.includes('tos') ||
    link.text.includes('mentions légales') ||
    link.text.includes('conditions générales') ||
    link.text.includes('cgv') ||
    link.text.includes('cgu') ||
    link.href.includes('terms') ||
    link.href.includes('conditions') ||
    link.href.includes('mentions-legales') ||
    link.href.includes('legal')
  ) || null;
  
  const privacyLink = links.find((link: Link) => 
    link.text.includes('privacy') || 
    link.text.includes('vie privée') ||
    link.text.includes('données personnelles') ||
    link.text.includes('confidentialité') ||
    link.href.includes('privacy') ||
    link.href.includes('confidentialite') ||
    link.href.includes('donnees-personnelles') ||
    link.href.includes('rgpd')
  ) || null;
  
  const cookieLink = links.find((link: Link) => 
    link.text.includes('cookie') || 
    link.text.includes('cookies') || 
    link.href.includes('cookie') ||
    link.href.includes('traceurs')
  ) || null;
  
  return { termsLink, privacyLink, cookieLink };
};

/**
 * Find and check links in the footer which often contains compliance documents
 */
const findFooterLinks = async (page: any): Promise<ComplianceLinks> => {
  const footerLinks = await page.evaluate(() => {
    // Try to find the footer element with different strategies
    const footer = document.querySelector('footer') || 
                  document.querySelector('.footer') ||
                  document.querySelector('#footer') ||
                  document.querySelector('[role="contentinfo"]') ||
                  document.querySelector('.bottom') ||
                  document.querySelector('.site-info');
                  
    if (!footer) return [];
    
    return Array.from(footer.querySelectorAll('a')).map(a => ({
      text: a.textContent?.trim().toLowerCase() || '',
      href: a.href
    }));
  });
  
  const termsLink = footerLinks.find((link: Link) => 
    link.text.includes('terms') || 
    link.text.includes('conditions') || 
    link.text.includes('mentions légales') ||
    link.text.includes('cgu') ||
    link.href.includes('legal') ||
    link.href.includes('mentions')
  ) || null;
  
  const privacyLink = footerLinks.find((link: Link) => 
    link.text.includes('privacy') || 
    link.text.includes('confidentialité') ||
    link.text.includes('données') ||
    link.href.includes('privacy') ||
    link.href.includes('donnees')
  ) || null;
  
  const cookieLink = footerLinks.find((link: Link) => 
    link.text.includes('cookie') || 
    link.href.includes('cookie')
  ) || null;
  
  return { termsLink, privacyLink, cookieLink };
};

/**
 * Check common sections like About or Legal pages that might contain or link to compliance docs
 */
const findMenuLinks = async (page: any): Promise<ComplianceLinks> => {
  // First, try to find "About", "Legal", or similar pages
  const menuLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).filter(a => {
      const text = a.textContent?.trim().toLowerCase() || '';
      return text.includes('about') || 
             text.includes('à propos') || 
             text.includes('legal') || 
             text.includes('légal') ||
             text.includes('juridique') ||
             text.includes('aide') ||
             text.includes('help');
    }).map(a => ({
      text: a.textContent?.trim().toLowerCase() || '',
      href: a.href
    }));
  });
  
  // We'll return these if we find them in a second phase
  let termsLink: Link | null = null;
  let privacyLink: Link | null = null;
  let cookieLink: Link | null = null;
  
  // For each potential navigation page, visit it and look for compliance links
  for (const link of menuLinks.slice(0, 3)) { // Limit to first 3 to avoid too many requests
    try {
      const subPage = await page.context().newPage();
      await subPage.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const subPageLinks = await subPage.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent?.trim().toLowerCase() || '',
          href: a.href
        }));
      });
      
      if (!termsLink) {
        termsLink = subPageLinks.find((link: Link) => 
          link.text.includes('terms') || 
          link.text.includes('conditions') || 
          link.text.includes('mentions légales') ||
          link.href.includes('legal')
        ) || null;
      }
      
      if (!privacyLink) {
        privacyLink = subPageLinks.find((link: Link) => 
          link.text.includes('privacy') || 
          link.text.includes('confidentialité') ||
          link.href.includes('rgpd')
        ) || null;
      }
      
      if (!cookieLink) {
        cookieLink = subPageLinks.find((link: Link) => 
          link.text.includes('cookie') || 
          link.href.includes('cookie')
        ) || null;
      }
      
      await subPage.close();
      
      // If we found all links, stop exploring
      if (termsLink && privacyLink && cookieLink) break;
    } catch (error) {
      console.error(`Error exploring menu link ${link.href}:`, error);
    }
  }
  
  return { termsLink, privacyLink, cookieLink };
};

/**
 * Scrapes content from a specific page using OpenAI to extract the relevant content
 */
const scrapePageWithOpenAI = async (url: string, context: any, documentType: string): Promise<string> => {
  try {
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
      return `Failed to scrape ${documentType} content: OpenAI API key not found. Please add OPENAI_API_KEY to your .env file.`;
    }

    const page = await context.newPage();
    
    // Add improved handling for privacy management platforms
    const isPriaseePage = url.includes('privasee.io');
    const isPrivacyPortal = url.includes('privacy') || url.includes('cookie') || url.includes('terms');
    
    // For privacy management platforms, we need a longer timeout and wait for network idle
    const navigationOptions = {
      waitUntil: isPriaseePage || isPrivacyPortal ? 'networkidle' : 'domcontentloaded',
      timeout: isPriaseePage || isPrivacyPortal ? 60000 : 30000
    };
    
    await page.goto(url, navigationOptions);
    
    // For privacy portals, wait extra time for dynamic content to load
    if (isPriaseePage || isPrivacyPortal) {
      // Wait a bit longer for dynamic content
      await page.waitForTimeout(2000);
      
      // Try to click "Accept all" or similar buttons if they exist (for cookie popups)
      try {
        await page.evaluate(() => {
          const acceptButtons = Array.from(document.querySelectorAll('button'))
            .filter(button => {
              const text = button.textContent?.toLowerCase() || '';
              return text.includes('accept') || text.includes('agree') || text.includes('continue');
            });
          if (acceptButtons.length > 0) {
            (acceptButtons[0] as HTMLElement).click();
          }
        });
        // Wait a bit more after clicking
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log('No accept buttons found or error clicking:', error);
      }
    }
    
    // Get just the text content to reduce token usage
    const pageContent = await page.evaluate(() => {
      // Attempt to remove non-content elements to reduce noise
      const elementsToRemove = [
        'header', 'nav', 'footer', '.header', '.footer', '.navigation', '.menu', 
        '.cookie-banner', '.cookie-notice', '.sidebar', '.ads', '.advertisement'
      ];
      
      elementsToRemove.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          try { el.remove(); } catch (e) {}
        });
      });
      
      // Try to find policy specific container first
      const possiblePolicyContainers = [
        '.privacy-policy', '.privacy', '.policy-content', '.cookie-policy',
        '#privacy-policy', '#cookie-policy', '.terms-content', '.legal-content',
        '[data-content="privacy"]', '[data-content="policy"]',
        'article', 'main', '.main-content', '.content-main', '.content'
      ];
      
      let policyContainer = null;
      for (const selector of possiblePolicyContainers) {
        const container = document.querySelector(selector);
        if (container && container.textContent && container.textContent.trim().length > 200) {
          policyContainer = container;
          break;
        }
      }
      
      // Extract clean text
      function extractCleanText(element: HTMLElement) {
        // Get all text nodes
        const textNodes = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
          // Only keep non-empty text nodes
          if ((node.textContent ?? '').trim()) {
            // Check if the parent is not a script or style element
            const parentNodeName = node.parentElement?.nodeName.toLowerCase() ?? '';
            if (parentNodeName !== 'script' && parentNodeName !== 'style') {
              textNodes.push(node.textContent);  // Store the text content, not the node
            }
          }
        }
        
        // Join with newlines for readability
        return textNodes.join('\n').replace(/\n{3,}/g, '\n\n');
      }
      
      // If we found a specific container, return just that content
      if (policyContainer) {
        return extractCleanText(policyContainer as HTMLElement);
      }
      
      // Otherwise, return the text from the body
      return extractCleanText(document.body as HTMLElement);
    });
    
    // Close the page as we don't need it anymore
    await page.close();
    
    // Truncate content to fit within token limits (80k chars max)
    const truncatedContent = pageContent.length > 80000 
      ? pageContent.substring(0, 80000) + '...[truncated]' 
      : pageContent;
    
    // Log a preview of the content for debugging
    const contentPreviewLength = 500; // Characters to show at beginning and end
    const contentPreview = truncatedContent.length > contentPreviewLength * 2 
      ? `${truncatedContent.substring(0, contentPreviewLength)}
      
      ... [${truncatedContent.length - (contentPreviewLength * 2)} characters omitted] ...
      
      ${truncatedContent.substring(truncatedContent.length - contentPreviewLength)}`
      : truncatedContent;
    
    console.log(`\n\n========== TEXT PREVIEW FOR ${documentType.toUpperCase()} (${url}) ==========`);
    console.log(contentPreview);
    console.log(`\n========== END TEXT PREVIEW (total length: ${truncatedContent.length} characters) ==========\n`);
    
    // Special handling for privasee.io which uses a specific structure
    let enrichedPrompt = '';
    if (isPriaseePage) {
      enrichedPrompt = `This is text from a page on Privasee.io, which is a privacy compliance platform. 
Look carefully for any content related to ${documentType}.
`;
    }
    
    // Improved prompt for the model to extract just the policy
    const prompt = `Extract the complete content of the ${documentType} from this text. 
Only extract the actual policy text, not navigation, headers, footers, or other website elements.
${enrichedPrompt}
If you absolutely cannot find any content related to ${documentType}, respond with "No ${documentType} found on this page."
Preserve the formatting and structure of the policy as much as possible.

Text content:
${truncatedContent}`;

    console.log(`Sending text to OpenAI to extract ${documentType}...`);
    
    // Use gpt-3.5-turbo by default - much better token limits
    const messages = [
      {
        role: 'system',
        content: `You are a specialized content extractor for legal documents. Your task is to extract the ${documentType} content from text. Be thorough and extract only relevant content.`
      },
      {
        role: 'user',
        content: prompt
      }
    ];
    
    // Call with retry and use gpt-3.5-turbo by default
    const data = await callOpenAIWithRetry(messages, 'gpt-3.5-turbo', 2500);
    
    // Extract the policy content from OpenAI's response
    const extractedContent = data.choices[0].message.content.trim();
    
    // Log the OpenAI response
    console.log(`\n\n========== OPENAI RESPONSE FOR ${documentType.toUpperCase()} ==========`);
    console.log(`Model used: ${data.model}`);
    console.log(`Tokens used: ${data.usage.total_tokens} (${data.usage.prompt_tokens} prompt + ${data.usage.completion_tokens} completion)`);
    console.log(`\nExtracted content (${extractedContent.length} characters):`);
    console.log(extractedContent.substring(0, 500) + (extractedContent.length > 500 ? '...' : ''));
    console.log(`\n========== END OPENAI RESPONSE ==========\n`);
    
    return extractedContent;
  } catch (error: unknown) {
    console.error(`Error scraping ${documentType} from ${url}:`, error);
    
    if (error && typeof error === 'object' && 'response' in error && 
        error.response && typeof error.response === 'object' && 'data' in error.response) {
      console.error('OpenAI API error:', error.response.data);
    }
    
    return `Failed to scrape ${documentType} content from ${url}: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * Scrapes a page that contains both privacy and cookie policies
 */
const scrapePageForMultiplePolicies = async (url: string, context: any): Promise<{privacyPolicy: string, cookiePolicy: string}> => {
  const page = await context.newPage();
  
  try {
    // Add improved handling for privacy management platforms
    const isPriaseePage = url.includes('privasee.io');
    const isPrivacyPortal = url.includes('privacy') || url.includes('cookie') || url.includes('terms');
    
    // For privacy management platforms, we need a longer timeout and wait for network idle
    const navigationOptions = {
      waitUntil: isPriaseePage || isPrivacyPortal ? 'networkidle' : 'domcontentloaded',
      timeout: isPriaseePage || isPrivacyPortal ? 60000 : 30000
    };
    
    await page.goto(url, navigationOptions);
    
    // For privacy portals, wait extra time for dynamic content to load
    if (isPriaseePage || isPrivacyPortal) {
      await page.waitForTimeout(5000); // Longer wait time for dynamic content
      
      // Click any "Accept" buttons
      try {
        await page.evaluate(() => {
          const acceptButtons = Array.from(document.querySelectorAll('button, a'))
            .filter(button => {
              const text = button.textContent?.toLowerCase() || '';
              return text.includes('accept') || text.includes('agree') || text.includes('continue') || 
                     text.includes('accept all') || text.includes('accepter') || text.includes('j\'accepte');
            });
          if (acceptButtons.length > 0) {
            (acceptButtons[0] as HTMLElement).click();
          }
        });
        await page.waitForTimeout(2000);
      } catch (error) {
        console.log('No accept buttons found or error clicking:', error);
      }
    }
    
    // Get just the text content instead of HTML to reduce token usage
    const pageContent = await page.evaluate(() => {
      // Attempt to remove non-content elements to reduce noise
      const elementsToRemove = [
        'header', 'nav', 'footer', '.header', '.footer', '.navigation', '.menu', 
        '.cookie-banner', '.cookie-notice', '.sidebar', '.ads', '.advertisement'
      ];
      
      elementsToRemove.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          try { el.remove(); } catch (e) {}
        });
      });
      
      // 1. Try to find privacy policy specific container first
      const possiblePolicyContainers = [
        '.privacy-policy', '.privacy', '.policy-content', '.cookie-policy',
        '#privacy-policy', '#cookie-policy', '.terms-content', '.legal-content',
        '[data-content="privacy"]', '[data-content="policy"]',
        'article', 'main', '.main-content', '.content-main', '.content'
      ];
      
      let policyContainer = null;
      for (const selector of possiblePolicyContainers) {
        const container = document.querySelector(selector);
        if (container && container.textContent && container.textContent.trim().length > 200) {
          policyContainer = container;
          break;
        }
      }
      
      // If we found a specific container, return just the TEXT content
      if (policyContainer) {
        // Extract and clean text content to reduce tokens
        return extractCleanText(policyContainer as HTMLElement);
      }
      
      // 2. Otherwise, return the cleaned text content from the body
      return extractCleanText(document.body as HTMLElement);
      
      // Helper function to extract and clean text
      function extractCleanText(element: HTMLElement) {
        // Get all text nodes
        const textNodes = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
          // Only keep non-empty text nodes
          if ((node.textContent ?? '').trim()) {
            // Check if the parent is not a script or style element
            const parentNodeName = node.parentElement?.nodeName.toLowerCase() ?? '';
            if (parentNodeName !== 'script' && parentNodeName !== 'style') {
              textNodes.push(node.textContent);  // Store the text content, not the node
            }
          }
        }
        
        // Join with newlines for readability
        return textNodes.join('\n').replace(/\n{3,}/g, '\n\n');
      }
    });
    
    await page.close();
    
    // Prepare truncated content for OpenAI - use much stricter limits to reduce token usage
    const truncatedContent = pageContent.length > 80000 
      ? pageContent.substring(0, 80000) + '...[truncated]' 
      : pageContent;
    
    // Log a preview
    const contentPreviewLength = 500;
    const contentPreview = truncatedContent.length > contentPreviewLength * 2 
      ? `${truncatedContent.substring(0, contentPreviewLength)}
      
      ... [${truncatedContent.length - (contentPreviewLength * 2)} characters omitted] ...
      
      ${truncatedContent.substring(truncatedContent.length - contentPreviewLength)}`
      : truncatedContent;
    
    console.log(`\n\n========== TEXT CONTENT PREVIEW FOR COMBINED POLICIES (${url}) ==========`);
    console.log(contentPreview);
    console.log(`\n========== END TEXT PREVIEW (total length: ${truncatedContent.length} characters) ==========\n`);
    
    // Better prompt for extracting content
    const prompt = `This is the text content from a webpage that contains a privacy policy and possibly a cookie policy.

Your task is to extract:
1. The complete privacy policy text
2. The complete cookie policy text (if present)

Important guidelines:
- Focus on identifying and extracting just the policy text
- Separate the privacy policy from the cookie policy
- If the cookie policy is part of the privacy policy, extract the cookie-related sections separately

Format your response using plain text markers as follows:

PRIVACY POLICY:
[Insert the complete privacy policy text here]

COOKIE POLICY:
[Insert the complete cookie policy text here OR "No dedicated cookie policy found"]

Text content:
${truncatedContent}`;

    console.log('Sending text content to OpenAI to extract policies...');
    
    // Use our retry function with fallback to cheaper model
    const messages = [
      {
        role: 'system',
        content: 'You are an expert at extracting legal policy content from webpage text. Your job is to find and extract the complete text of privacy and cookie policies.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];
    
    // Start with a smaller token limit to reduce impact
    const data = await callOpenAIWithRetry(messages, 'gpt-3.5-turbo', 3000, 4);
    const content = data.choices[0].message.content;
    
    // Log the entire response for debugging
    console.log(`\n\n========== FULL OPENAI RESPONSE ==========`);
    console.log(content);
    console.log(`\n========== END FULL OPENAI RESPONSE ==========\n`);
    
    // Extract policies using simple text markers
    const privacyMarker = "PRIVACY POLICY:";
    const cookieMarker = "COOKIE POLICY:";
    
    const privacyStart = content.indexOf(privacyMarker);
    const cookieStart = content.indexOf(cookieMarker);
    
    let privacyPolicy = "No privacy policy found on this page.";
    let cookiePolicy = "No cookie policy found on this page.";
    
    if (privacyStart !== -1 && cookieStart !== -1 && privacyStart < cookieStart) {
      // Both markers found and in correct order
      privacyPolicy = content.substring(privacyStart + privacyMarker.length, cookieStart).trim();
      cookiePolicy = content.substring(cookieStart + cookieMarker.length).trim();
    } else if (privacyStart !== -1 && cookieStart === -1) {
      // Only privacy policy found
      privacyPolicy = content.substring(privacyStart + privacyMarker.length).trim();
    } else if (cookieStart !== -1 && privacyStart === -1) {
      // Only cookie policy found (unlikely)
      cookiePolicy = content.substring(cookieStart + cookieMarker.length).trim();
    } else if (privacyStart !== -1 && cookieStart !== -1 && cookieStart < privacyStart) {
      // Markers found but in wrong order
      cookiePolicy = content.substring(cookieStart + cookieMarker.length, privacyStart).trim();
      privacyPolicy = content.substring(privacyStart + privacyMarker.length).trim();
    }
    
    // Handle "No dedicated cookie policy found" case
    if (cookiePolicy.includes("No dedicated cookie policy found") || 
        cookiePolicy.includes("No cookie policy found")) {
      // For cookies, we'll try a simpler approach with fewer tokens
      console.log('No dedicated cookie policy found, attempting to extract cookie sections from privacy policy...');
      
      // Use a shorter prompt with only the necessary parts of the privacy policy
      // to reduce token usage
      const shortPrivacy = privacyPolicy.length > 20000 
        ? privacyPolicy.substring(0, 20000) + '...[truncated]' 
        : privacyPolicy;
          
      const extractCookiePrompt = `Find ONLY the sections about cookies, tracking technologies, or similar technologies in this privacy policy. If there are no cookie sections, respond with "No cookie information found".

${shortPrivacy}`;

      // Use the retry function with a more economical model
      const cookieExtractData = await callOpenAIWithRetry([
        {
          role: 'system',
          content: 'Extract only cookie-related information from text.'
        },
        {
          role: 'user',
          content: extractCookiePrompt
        }
      ], 'gpt-3.5-turbo', 1500, 3);
      
      const extractedCookieContent = cookieExtractData.choices[0].message.content.trim();
      
      if (!extractedCookieContent.includes("No cookie information found")) {
        cookiePolicy = extractedCookieContent;
      }
    }
    
    console.log(`\n\n========== EXTRACTED POLICIES ==========`);
    console.log(`Privacy policy length: ${privacyPolicy.length} characters`);
    console.log(`Cookie policy length: ${cookiePolicy.length} characters`);
    console.log(`Privacy policy preview:`, privacyPolicy.substring(0, 100) + '...');
    console.log(`Cookie policy preview:`, cookiePolicy.substring(0, 100) + '...');
    console.log(`\n========== END EXTRACTED POLICIES ==========\n`);
    
    return {
      privacyPolicy,
      cookiePolicy
    };
  } catch (error: unknown) {
    console.error(`Error scraping combined policies from ${url}:`, error);
    
    if (error && typeof error === 'object' && 'response' in error && 
        error.response && typeof error.response === 'object' && 'data' in error.response) {
      console.error('OpenAI API error:', error.response.data);
    }
    
    return {
      privacyPolicy: `Failed to extract privacy policy from ${url}: ${error instanceof Error ? error.message : String(error)}`,
      cookiePolicy: `Failed to extract cookie policy from ${url}: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Extracts cookie policy information from a privacy policy
 */
const extractCookiePolicyFromPrivacyPolicy = async (privacyPolicyText: string | null): Promise<string> => {
  if (!privacyPolicyText) {
    return "No privacy policy was found from which to extract cookie information.";
  }
  
  if (!OPENAI_API_KEY) {
    console.error('OpenAI API key not found in environment variables');
    return 'Failed to extract cookie policy: OpenAI API key not found.';
  }
  
  try {
    // Truncate the privacy policy to reduce token usage
    const truncatedPolicy = privacyPolicyText.length > 25000 
      ? privacyPolicyText.substring(0, 25000) + '...[truncated]' 
      : privacyPolicyText;
    
    const prompt = `Find and extract ONLY the sections about cookies, tracking technologies, or similar technologies in this privacy policy. If there are no cookie sections, respond with "No cookie information found".

${truncatedPolicy}`;

    console.log('Extracting cookie policy information from privacy policy...');
    
    // Use gpt-3.5-turbo directly
    const data = await callOpenAIWithRetry([
      {
        role: 'system',
        content: 'Extract only cookie-related information from text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], 'gpt-3.5-turbo', 1500);
    
    const extractedContent = data.choices[0].message.content.trim();
    
    console.log(`\n\n========== COOKIE INFORMATION EXTRACTED FROM PRIVACY POLICY ==========`);
    console.log(`Tokens used: ${data.usage.total_tokens} (${data.usage.prompt_tokens} prompt + ${data.usage.completion_tokens} completion)`);
    console.log(`Extracted content length: ${extractedContent.length}`);
    console.log(`\n========== END EXTRACTION ==========\n`);
    
    return extractedContent;
  } catch (error: unknown) {
    console.error('Error extracting cookie policy from privacy policy:', error);
    
    if (error && typeof error === 'object' && 'response' in error && 
        error.response && typeof error.response === 'object' && 'data' in error.response) {
      console.error('OpenAI API error:', error.response.data);
    }
    
    return `Failed to extract cookie policy information: ${error instanceof Error ? error.message : String(error)}`;
  }
}; 