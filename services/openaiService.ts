import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get OrqAI API key from environment variables
const ORQ_API_KEY = process.env.ORQ_API_KEY || '';
const ORQ_REQUEST_ID = process.env.ORQ_REQUEST_ID || '01JVGZ0JR685TY4K64B0HQMDJY';
const ORQ_CUSTOMER_ID = process.env.ORQ_CUSTOMER_ID || 'cus_1234567890';
const ORQ_DEPLOYMENT_KEY = process.env.ORQ_DEPLOYMENT_KEY || 'Deployment_Example';

// OrqAI response types
interface OrqMessage {
  type: string;
  content: string | null;
}

interface OrqChoice {
  message: OrqMessage;
  index?: number;
}

interface OrqResponse {
  id?: string;
  choices?: OrqChoice[];
}

// OpenAI API response types
export interface OpenAIMessage {
  role: string;
  content: string;
}

export interface OpenAIChoice {
  message: OpenAIMessage;
  index: number;
  finish_reason: string;
}

export interface OpenAIResponse {
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
 * (Now implemented using OrqAI direct HTTP calls)
 */
export async function callOpenAIWithRetry(
  messages: {role: string, content: string}[], 
  model = 'gpt-3.5-turbo', 
  maxTokens = 4096, 
  retries = 2
): Promise<OpenAIResponse> {
  let retryCount = 0;
  let lastError: unknown;
  
  // Prepare the question from messages
  // Taking the last user message as the question
  const userMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
  
  while (retryCount <= retries) {
    try {
      if (retryCount > 0) {
        // If this is a retry, use a shorter backoff to avoid long waits
        let backoffTime = Math.min(Math.pow(2, retryCount) * 1000, 4000);
        console.log(`Retrying in ${backoffTime/1000} seconds (attempt ${retryCount} of ${retries})...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
      
      // Make a direct HTTP call using axios exactly as in the cURL example
      const response = await axios.post<OrqResponse>(
        'https://my.orq.ai/v2/deployments/invoke',
        {
          key: ORQ_DEPLOYMENT_KEY,
          context: {
            environments: []
          },
          inputs: {
            question: userMessage
          },
          metadata: {
            request_id: ORQ_REQUEST_ID,
            customer_id: ORQ_CUSTOMER_ID
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${ORQ_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );
      
      // Extract the completion from the response
      const completion = response.data;
      
      // Check if we have a valid response
      if (!completion) {
        throw new Error('No response received from OrqAI');
      }
      
      let assistantContent = '';
      // Get the content from the OrqAI response
      if (completion?.choices?.[0]?.message?.type === 'content') {
        assistantContent = completion?.choices?.[0]?.message?.content || '';
      }
      
      // Create a mapped response to maintain OpenAI compatibility
      return {
        id: completion.id || '',
        object: 'chat.completion',
        created: Date.now(),
        model: model,
        choices: [{
          message: {
            role: 'assistant',
            content: assistantContent
          },
          index: 0,
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    } catch (error: unknown) {
      lastError = error;
      
      // Simple retry logic
      if (error && typeof error === 'object') {
        retryCount++;
        
        if (retryCount > retries) {
          console.error(`Error persisted after ${retries} retries. Giving up.`);
          break;
        }
        
        continue;
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}

/**
 * Check if OpenAI API key is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!ORQ_API_KEY; // Check if OrqAI API key is available
}

/**
 * Get the OpenAI API key
 */
export function getOpenAIApiKey(): string | undefined {
  return ORQ_API_KEY; // Return OrqAI API key
} 