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
  console.log(`Generated ${prompts.length} prompts for processing`);
  
  const results: AstriaPromptResult[] = [];
  const failedPrompts: Array<{ index: number; prompt: string; error: string }> = [];
  let totalSuccessfulPrompts = 0;

  // Images per prompt based on plan type, will be multiplied by 10 prompts
  const targetImagesPerPrompt = planType === "basic" ? 1 
    : planType === "professional" ? 10 
    : planType === "executive" ? 20 
    : 1;

  const GLOBAL_MAX_RETRIES = 3; // Maximum number of times to retry the entire prompt set
  let globalRetryCount = 0;

  while (totalSuccessfulPrompts < prompts.length && globalRetryCount < GLOBAL_MAX_RETRIES) {
    // Clear previous results if this is a retry
    if (globalRetryCount > 0) {
      console.log(`Global retry attempt ${globalRetryCount + 1}`);
      results.length = 0;
      failedPrompts.length = 0;
    }

    // Process prompts with retries
    for (let promptIndex = 0; promptIndex < prompts.length; promptIndex++) {
      // Skip prompts that were already successful in previous attempts
      if (results.some(r => r.promptIndex === promptIndex)) {
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

            console.log(`Sending request for ${imagesThisCall} images`);

            const response = await fetchWithRetry(API_URL, {
              method: 'POST',
              headers: headers,
              body: form
            });

            const result = await response.json();
            
            // Validate the result
            if (!result || result.error) {
              throw new Error(`Invalid response from Astria API: ${JSON.stringify(result)}`);
            }
            
            result.promptIndex = promptIndex; // Store the prompt index with the result
            results.push(result);
            success = true;
            totalSuccessfulPrompts++;
            console.log(`Successfully processed prompt ${promptIndex + 1}, attempt ${retryCount + 1}`);

            // Simple 1s delay between any API calls
            if (i < numberOfCalls - 1 || promptIndex < prompts.length - 1) {
              await sleep(DELAY);
            }
          }
        } catch (error) {
          console.error(`Error processing prompt ${promptIndex + 1} (attempt ${retryCount + 1}):`, error);
          retryCount++;
          
          if (retryCount < MAX_RETRIES) {
            const delayTime = RETRY_DELAY * Math.pow(2, retryCount - 1); // Exponential backoff
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

    // If we still don't have all prompts, increment global retry counter
    if (totalSuccessfulPrompts < prompts.length) {
      globalRetryCount++;
      if (globalRetryCount < GLOBAL_MAX_RETRIES) {
        console.log(`Not all prompts were successful (${totalSuccessfulPrompts}/${prompts.length}). Starting global retry ${globalRetryCount + 1}...`);
        await sleep(RETRY_DELAY * Math.pow(2, globalRetryCount)); // Exponential backoff for global retries
      }
    }
  }

  // Log summary of processing
  console.log('Prompt processing summary:', {
    totalPrompts: prompts.length,
    successfulPrompts: totalSuccessfulPrompts,
    failedPrompts: failedPrompts.length,
    failedDetails: failedPrompts,
    globalRetries: globalRetryCount
  });

  // If we don't have all prompts after all retries, return error
  if (totalSuccessfulPrompts < prompts.length) {
    console.error(`Failed to process all prompts after ${GLOBAL_MAX_RETRIES} global retries`);
    return { 
      error: true, 
      message: `Failed to process ${prompts.length - totalSuccessfulPrompts} prompts after all retries`, 
      failedPrompts,
      results // Include successful results so they're not lost
    };
  }

  console.log('All prompts initiated successfully:', results);
  return results;
}

