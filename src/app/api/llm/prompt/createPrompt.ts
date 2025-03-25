"use server"

// Importing the getPromptsAttributes function from the prompts file
// This function returns the 10 prompts (one per style), which determines total images:
// - Basic Plan: 1 image × 10 prompts = 10 total images
// - Professional Plan: 10 images × 10 prompts = 100 total images
// - Executive Plan: 20 images × 10 prompts = 200 total images
import { getPromptsAttributes } from './prompts';

// API key and domain for the external service
const API_KEY = process.env.ASTRIA_API_KEY; // Use API key from .env.local
const headers = { Authorization: `Bearer ${API_KEY}` }

const MAX_RETRIES = 5; // Increased from 3 to 5 for more reliability
const RETRY_DELAY = 1500; // Increased to 1.5 seconds
const VERIFICATION_DELAY = 3000; // 3 seconds for verification

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
      await sleep(RETRY_DELAY * (retries + 1)); // Progressive backoff
      return fetchWithRetry(url, options, retries + 1);
    }
    throw error;
  }
}

// Function to create prompts with guaranteed image generation
export async function createPrompt(userData: any) {
  const user = userData[0];
  const { id, planType } = user;

  const API_URL = `https://api.astria.ai/tunes/1504944/prompts`;
  const webhookSecret = process.env.APP_WEBHOOK_SECRET;

  // Get prompts from prompts.ts file (always returns 10 for all plan types)
  const prompts = getPromptsAttributes(user);
  
  // IMPORTANT: Validate we have exactly 10 prompts for basic plan
  if (prompts.length !== 10) {
    console.error(`Expected 10 prompts but got ${prompts.length}. Will generate exact count of prompts.`);
    // Adjust to exactly 10 prompts if needed
    // Either duplicate or trim as necessary
    while (prompts.length < 10) {
      // Duplicate the first prompt if we have less than 10
      prompts.push({...prompts[0]});
    }
    // If we somehow have more than 10 prompts, trim the array
    if (prompts.length > 10) {
      prompts.length = 10;
    }
  }

  const results = [];
  const failedPrompts = [];

  // Images per prompt based on plan type, will be multiplied by 10 prompts
  const targetImagesPerPrompt = planType === "basic" ? 1 
    : planType === "professional" ? 10 
    : planType === "executive" ? 20 
    : 1;

  // Process prompts with extra care for basic plan
  for (let promptIndex = 0; promptIndex < prompts.length; promptIndex++) {
    const prompt = prompts[promptIndex];
    try {
      console.log(`Processing prompt ${promptIndex + 1}/${prompts.length}`);
      
      // For all plan types, use a consistent approach with guaranteed execution
      const numberOfCalls = Math.ceil(targetImagesPerPrompt / 8);
      let remainingImages = targetImagesPerPrompt;

      // Multiple API calls for each prompt if needed (usually just 1 for basic plan)
      for (let i = 0; i < numberOfCalls; i++) {
        const imagesThisCall = Math.min(8, remainingImages);
        remainingImages -= imagesThisCall;
        
        const form = new FormData();
        form.append('prompt[text]', prompt.text);
        form.append('prompt[callback]', `https://www.youphotoshoot.com/api/llm/prompt-webhook?webhook_secret=${webhookSecret}&user_id=${id}`);
        form.append('prompt[num_images]', imagesThisCall.toString());

        // Use retry mechanism for API calls
        let result;
        try {
          const response = await fetchWithRetry(API_URL, {
            method: 'POST',
            headers: headers,
            body: form
          });
          result = await response.json();
          results.push(result);
          console.log(`Prompt ${promptIndex + 1} (call ${i+1}/${numberOfCalls}) succeeded:`, result);
        } catch (callError) {
          console.error(`Error in API call for prompt ${promptIndex + 1} (call ${i+1}/${numberOfCalls}):`, callError);
          // Track failed prompts for retry
          failedPrompts.push({
            promptIndex,
            prompt,
            imagesRequested: imagesThisCall
          });
          // Continue with next prompt instead of failing completely
          continue;
        }

        // Simple delay between API calls to avoid rate limiting
        if (i < numberOfCalls - 1 || promptIndex < prompts.length - 1) {
          await sleep(RETRY_DELAY);
        }
      }
    } catch (error) {
      console.error(`Error processing prompt ${promptIndex + 1}:`, error);
      // Track failed prompts for retry
      failedPrompts.push({
        promptIndex,
        prompt,
        imagesRequested: targetImagesPerPrompt
      });
    }
  }

  // Handle any failed prompts with retries (critical for basic plan)
  if (failedPrompts.length > 0) {
    console.log(`Retrying ${failedPrompts.length} failed prompts...`);
    
    // Wait a bit longer before retrying failed prompts
    await sleep(VERIFICATION_DELAY);
    
    for (const failedPrompt of failedPrompts) {
      try {
        console.log(`Retrying prompt ${failedPrompt.promptIndex + 1}`);
        
        const form = new FormData();
        form.append('prompt[text]', failedPrompt.prompt.text);
        form.append('prompt[callback]', `https://www.youphotoshoot.com/api/llm/prompt-webhook?webhook_secret=${webhookSecret}&user_id=${id}`);
        form.append('prompt[num_images]', failedPrompt.imagesRequested.toString());

        const response = await fetchWithRetry(API_URL, {
          method: 'POST',
          headers: headers,
          body: form
        }, 0); // Start fresh with retries
        
        const result = await response.json();
        results.push(result);
        console.log(`Retry for prompt ${failedPrompt.promptIndex + 1} succeeded:`, result);
        
        // Add delay between retries
        await sleep(RETRY_DELAY);
      } catch (retryError) {
        console.error(`Final error retrying prompt ${failedPrompt.promptIndex + 1}:`, retryError);
        // Even with retries, we failed - this is critical for basic plan
        if (planType === "basic") {
          return { 
            error: true, 
            message: `Failed to generate all 10 required images for basic plan. Prompt ${failedPrompt.promptIndex + 1} failed.`,
            results
          };
        }
      }
    }
  }

  // Validate results count for basic plan (must have exactly 10 prompts)
  if (planType === "basic" && results.length < 10) {
    console.error(`ERROR: Only generated ${results.length} of 10 required images for basic plan.`);
    return { 
      error: true, 
      message: `Failed to generate all 10 required images for basic plan. Only ${results.length} were successful.`,
      results
    };
  }

  console.log(`All prompts initiated successfully. Generated ${results.length} results.`);
  return results;
}

