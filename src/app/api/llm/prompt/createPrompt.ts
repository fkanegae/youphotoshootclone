"use server"

// Importing the getPromptsAttributes function from the prompts file
// This function always returns 10 prompts (one per style), which determines total images:
// - Basic Plan: 1 image × 10 prompts = 10 total images
// - Professional Plan: 10 images × 10 prompts = 100 total images
// - Executive Plan: 20 images × 10 prompts = 200 total images
import { getPromptsAttributes } from './prompts';

// API key and domain for the external service
const API_KEY = process.env.ASTRIA_API_KEY; // Use API key from .env.local
const headers = { Authorization: `Bearer ${API_KEY}` }

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const DELAY = 1000; // 1 second between API calls

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, retries: number = 0): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
    }
    return response;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.log(`Retrying... (${retries + 1}/${MAX_RETRIES})`);
      await sleep(RETRY_DELAY);
      return fetchWithRetry(url, options, retries + 1);
    }
    throw error;
  }
}

// Add interface for Astria API response
interface AstriaPromptResult {
  promptIndex?: number;
  id?: number;
  text?: string;
  images?: string[];
  steps?: number;
  tune_id?: number;
  created_at?: string;
  trained_at?: string;
  updated_at?: string;
  negative_prompt?: string;
  started_training_at?: string;
  error?: boolean;
}

/// Function to create prompts
export async function createPrompt(userData: any) {
  const user = userData[0];
  const { id, planType } = user;

  const API_URL = `https://api.astria.ai/tunes/1504944/prompts`;
  const webhookSecret = process.env.APP_WEBHOOK_SECRET;

  const prompts = getPromptsAttributes(user);
  const REQUIRED_PROMPT_COUNT = 10; // Hardcoded requirement for exactly 10 prompts
  
  if (prompts.length !== REQUIRED_PROMPT_COUNT) {
    console.error(`Invalid number of prompts generated. Expected ${REQUIRED_PROMPT_COUNT}, got ${prompts.length}`);
    throw new Error(`Must generate exactly ${REQUIRED_PROMPT_COUNT} prompts`);
  }

  console.log(`Generated ${prompts.length} prompts for processing`);
  
  const results: AstriaPromptResult[] = [];
  const failedPrompts: Array<{ index: number; prompt: string; error: string }> = [];
  let totalSuccessfulPrompts = 0;

  // Images per prompt based on plan type, will be multiplied by 10 prompts
  const targetImagesPerPrompt = planType === "basic" ? 1 
    : planType === "professional" ? 10 
    : planType === "executive" ? 20 
    : 1;

  const GLOBAL_MAX_RETRIES = 5; // Increased from 3 to 5 for more persistence
  let globalRetryCount = 0;

  // Track successful prompts across retries
  const successfulPromptIndexes = new Set<number>();

  while (successfulPromptIndexes.size < REQUIRED_PROMPT_COUNT && globalRetryCount < GLOBAL_MAX_RETRIES) {
    // Clear previous results if this is a retry
    if (globalRetryCount > 0) {
      console.log(`Global retry attempt ${globalRetryCount + 1}`);
      results.length = 0;
      failedPrompts.length = 0;
    }

    // Process prompts with retries
    for (let promptIndex = 0; promptIndex < prompts.length; promptIndex++) {
      // Skip prompts that were already successful in previous attempts
      if (successfulPromptIndexes.has(promptIndex)) {
        console.log(`Skipping prompt ${promptIndex + 1} as it was already successful`);
        continue;
      }

      const prompt = prompts[promptIndex];
      let retryCount = 0;
      let success = false;

      console.log(`Processing prompt ${promptIndex + 1}/${prompts.length}: ${prompt.text}`);

      while (!success && retryCount < MAX_RETRIES) {
        try {
          console.log(`Attempt ${retryCount + 1} for prompt ${promptIndex + 1}`);
          
          const numberOfCalls = Math.ceil(targetImagesPerPrompt / 8);
          let remainingImages = targetImagesPerPrompt;

          // Multiple API calls for each prompt if needed
          for (let i = 0; i < numberOfCalls; i++) {
            const imagesThisCall = Math.min(8, remainingImages);
            remainingImages -= imagesThisCall;
            
            const form = new FormData();
            form.append('prompt[text]', prompt.text);
            form.append('prompt[callback]', `https://www.youphotoshoot.com/api/llm/prompt-webhook?webhook_secret=${webhookSecret}&user_id=${id}`);
            form.append('prompt[num_images]', imagesThisCall.toString());

            console.log(`Sending request for ${imagesThisCall} images for prompt ${promptIndex + 1}`);

            const response = await fetchWithRetry(API_URL, {
              method: 'POST',
              headers: headers,
              body: form
            });

            const result = await response.json();
            
            // Enhanced result validation
            if (!result || result.error || !result.id) {
              throw new Error(`Invalid response from Astria API: ${JSON.stringify(result)}`);
            }
            
            result.promptIndex = promptIndex;
            results.push(result);
            success = true;
            successfulPromptIndexes.add(promptIndex);
            console.log(`Successfully processed prompt ${promptIndex + 1}, attempt ${retryCount + 1}`);
            console.log(`Current successful prompts: ${successfulPromptIndexes.size}/${REQUIRED_PROMPT_COUNT}`);

            // Increased delay between calls to prevent rate limiting
            if (i < numberOfCalls - 1 || promptIndex < prompts.length - 1) {
              const delayTime = DELAY * 2; // Doubled the delay
              console.log(`Waiting ${delayTime}ms before next API call...`);
              await sleep(delayTime);
            }
          }
        } catch (error) {
          console.error(`Error processing prompt ${promptIndex + 1} (attempt ${retryCount + 1}):`, error);
          retryCount++;
          
          if (retryCount < MAX_RETRIES) {
            const delayTime = RETRY_DELAY * Math.pow(2, retryCount); // Increased exponential backoff
            console.log(`Retrying prompt ${promptIndex + 1} in ${delayTime}ms...`);
            await sleep(delayTime);
          } else {
            console.error(`Failed to process prompt ${promptIndex + 1} after ${MAX_RETRIES} attempts`);
            failedPrompts.push({
              index: promptIndex,
              prompt: prompt.text,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
    }

    // Verify we have the correct number of successful prompts
    if (successfulPromptIndexes.size < REQUIRED_PROMPT_COUNT) {
      globalRetryCount++;
      if (globalRetryCount < GLOBAL_MAX_RETRIES) {
        const delayTime = RETRY_DELAY * Math.pow(2, globalRetryCount);
        console.log(`Not all prompts were successful (${successfulPromptIndexes.size}/${REQUIRED_PROMPT_COUNT}). Starting global retry ${globalRetryCount + 1} in ${delayTime}ms...`);
        await sleep(delayTime);
      }
    }
  }

  // Detailed logging of results
  console.log('Prompt processing summary:', {
    totalPrompts: prompts.length,
    successfulPrompts: successfulPromptIndexes.size,
    failedPrompts: failedPrompts.length,
    failedDetails: failedPrompts,
    globalRetries: globalRetryCount,
    successfulPromptIndexes: Array.from(successfulPromptIndexes)
  });

  // Strict validation of results
  if (successfulPromptIndexes.size < REQUIRED_PROMPT_COUNT) {
    console.error(`Failed to process all prompts after ${GLOBAL_MAX_RETRIES} global retries`);
    console.error('Missing prompt indexes:', Array.from({ length: REQUIRED_PROMPT_COUNT })
      .map((_, i) => i)
      .filter(i => !successfulPromptIndexes.has(i)));
    
    return { 
      error: true, 
      message: `Failed to process ${REQUIRED_PROMPT_COUNT - successfulPromptIndexes.size} prompts after all retries`, 
      failedPrompts,
      results,
      successfulCount: successfulPromptIndexes.size
    };
  }

  // Verify each result has the necessary data
  const validResults = results.filter(result => result && result.id && result.promptIndex !== undefined);
  if (validResults.length !== REQUIRED_PROMPT_COUNT) {
    console.error(`Invalid results count. Expected ${REQUIRED_PROMPT_COUNT}, got ${validResults.length}`);
    return {
      error: true,
      message: `Invalid number of results: ${validResults.length}/${REQUIRED_PROMPT_COUNT}`,
      results: validResults
    };
  }

  console.log(`Successfully processed all ${REQUIRED_PROMPT_COUNT} prompts:`, 
    validResults.map(r => ({ promptIndex: r.promptIndex, id: r.id })));
  return validResults;
}

