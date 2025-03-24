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

// Add max attempts per prompt at the top
const MAX_IMAGE_ATTEMPTS = 5; // Maximum retries per image batch

// Add at the top of the file
const MAX_IMAGES_PER_PROMPT = 20; // Absolute maximum per prompt

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

// Single delay constant for rate limiting
const DELAY = 1000; // 1 second between API calls

/// Function to create prompts
export async function createPrompt(userData: any) {
  const user = userData[0];
  const { id } = user;

  const tuneId = user.apiStatus?.id;
  if (!tuneId) {
    throw new Error("No tune ID found in user's API status");
  }

  const API_URL = `https://api.astria.ai/tunes/${tuneId}/prompts`;
  const webhookSecret = process.env.APP_WEBHOOK_SECRET;

  const prompts = getPromptsAttributes(user);
  const results = [];

  // Modify validation
  const planType = ((user.planType as string) || 'basic').toLowerCase();
  const targetImagesPerPrompt = 
    planType.includes('professional') ? 10 :
    planType.includes('executive') ? 20 : 
    1; // Default to basic

  const validatedImagesPerPrompt = Math.min(
    Math.max(targetImagesPerPrompt, 1),
    MAX_IMAGES_PER_PROMPT
  );

  // Add this validation at the start of the createPrompt function
  if (!user?.apiStatus?.id) {
    throw new Error("User's AI model training not completed");
  }

  // Process prompts
  for (let promptIndex = 0; promptIndex < prompts.length; promptIndex++) {
    const prompt = prompts[promptIndex];
    let attemptCount = 0;
    let remainingImages = validatedImagesPerPrompt;
    
    try {
      console.log(`Processing prompt ${promptIndex + 1}/${prompts.length}`);
      
      while (remainingImages > 0 && attemptCount < MAX_IMAGE_ATTEMPTS) {
        const imagesThisCall = Math.min(8, remainingImages);
        const form = new FormData();
        form.append('prompt[text]', prompt.text);
        form.append('prompt[callback]', `https://www.youphotoshoot.com/api/llm/prompt-webhook?webhook_secret=${webhookSecret}&user_id=${id}`);
        form.append('prompt[num_images]', imagesThisCall.toString());

        const response = await fetchWithRetry(API_URL, {
          method: 'POST',
          headers: headers,
          body: form
        });

        const result = await response.json();
        const receivedImages = result?.prompt?.images?.length || 0;
        
        // Handle over-delivery
        const actualReceived = Math.min(receivedImages, imagesThisCall);
        remainingImages -= actualReceived;

        // Log discrepancies
        if (receivedImages > imagesThisCall) {
          console.warn(`Astria over-delivered: ${receivedImages}/${imagesThisCall} images`);
        } else if (receivedImages < imagesThisCall) {
          console.warn(`Partial delivery: ${receivedImages}/${imagesThisCall} images`);
        }

        results.push(result);
        attemptCount++;
        
        // Add delay between attempts
        if (remainingImages > 0) {
          await sleep(DELAY);
        }
      }

      if (remainingImages > 0) {
        console.error(`Failed to get ${validatedImagesPerPrompt} images for prompt ${promptIndex + 1} after ${MAX_IMAGE_ATTEMPTS} attempts`);
      }

    } catch (err) {
      const error = err as Error;
      console.error(`Error processing prompt ${promptIndex + 1}:`, error);
      return { 
        error: true, 
        message: `Failed on prompt ${promptIndex + 1}: ${error.message}` 
      };
    }
  }

  console.log('All prompts initiated successfully:', results);
  return results;
}

