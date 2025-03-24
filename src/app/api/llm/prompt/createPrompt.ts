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

  // 1. Validation
  if (!user?.apiStatus?.id) {
    throw new Error("AI model training not completed");
  }

  // 2. Get exactly 10 prompts
  const prompts = getPromptsAttributes(user);
  if (prompts.length !== 10) {
    throw new Error(`Invalid prompt count: ${prompts.length}. Requires exactly 10.`);
  }

  // 3. Basic Plan Configuration
  const isBasicPlan = (user.planType || 'basic').toLowerCase() === 'basic';
  const imagesPerPrompt = isBasicPlan ? 1 : 10;

  // 4. Process all 10 prompts
  const results = [];
  for (let index = 0; index < prompts.length; index++) {
    const prompt = prompts[index];
    try {
      const form = new FormData();
      form.append('prompt[text]', prompt.text);
      form.append('prompt[callback]', `https://www.youphotoshoot.com/api/llm/prompt-webhook?webhook_secret=${process.env.APP_WEBHOOK_SECRET}&user_id=${id}`);
      form.append('prompt[num_images]', imagesPerPrompt.toString());

      const response = await fetch(`https://api.astria.ai/tunes/${user.apiStatus.id}/prompts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.ASTRIA_API_KEY}` },
        body: form
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      results.push(await response.json());
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit

    } catch (error) {
      console.error(`Prompt ${index + 1} failed:`, error);
      // Continue processing other prompts
      results.push({ error: true, message: `Prompt ${index + 1} failed` });
    }
  }

  return results;
}

