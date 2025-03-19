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
  isBackup?: boolean;
}

/// Function to create prompts
export async function createPrompt(userData: any) {
  const user = userData[0];
  const { id, planType, isBackupPrompt, backupCount } = user;

  const API_URL = `https://api.astria.ai/tunes/1504944/prompts`;
  const webhookSecret = process.env.APP_WEBHOOK_SECRET;

  const prompts = getPromptsAttributes(user);
  // For backup prompts, we'll use a smaller set
  const REQUIRED_PROMPT_COUNT = isBackupPrompt ? (backupCount || 5) : 10;
  
  // For backup prompts, we'll use the first N prompts
  const selectedPrompts = isBackupPrompt 
    ? prompts.slice(0, REQUIRED_PROMPT_COUNT)
    : prompts;

  if (selectedPrompts.length < REQUIRED_PROMPT_COUNT) {
    console.error(`Invalid number of prompts generated. Expected ${REQUIRED_PROMPT_COUNT}, got ${selectedPrompts.length}`);
    throw new Error(`Must generate exactly ${REQUIRED_PROMPT_COUNT} prompts`);
  }

  console.log(`Generated ${selectedPrompts.length} ${isBackupPrompt ? 'backup ' : ''}prompts for processing`);
  
  const results: AstriaPromptResult[] = [];
  const failedPrompts: Array<{ index: number; prompt: string; error: string }> = [];
  const pendingPrompts = new Set<number>();

  // For backup prompts, we'll request 2 images per prompt to increase chances
  const baseImagesPerPrompt = planType === "basic" ? 1 
    : planType === "professional" ? 10 
    : planType === "executive" ? 20 
    : 1;

  const targetImagesPerPrompt = isBackupPrompt 
    ? Math.min(baseImagesPerPrompt * 2, 8) // Double the images but cap at 8
    : baseImagesPerPrompt;

  const GLOBAL_MAX_RETRIES = isBackupPrompt ? 3 : 5; // Fewer retries for backup prompts
  let globalRetryCount = 0;

  // Track successful prompts across retries
  const successfulPromptIndexes = new Set<number>();

  while (successfulPromptIndexes.size < REQUIRED_PROMPT_COUNT && globalRetryCount < GLOBAL_MAX_RETRIES) {
    if (globalRetryCount > 0) {
      console.log(`Global retry attempt ${globalRetryCount + 1}`);
      failedPrompts.length = 0;
    }

    // Process prompts with retries
    for (let promptIndex = 0; promptIndex < selectedPrompts.length; promptIndex++) {
      if (successfulPromptIndexes.has(promptIndex)) {
        console.log(`Skipping prompt ${promptIndex + 1} as it was already successful`);
        continue;
      }

      const prompt = selectedPrompts[promptIndex];
      let retryCount = 0;
      let success = false;

      console.log(`Processing ${isBackupPrompt ? 'backup ' : ''}prompt ${promptIndex + 1}/${selectedPrompts.length}: ${prompt.text}`);

      while (!success && retryCount < MAX_RETRIES) {
        try {
          console.log(`Attempt ${retryCount + 1} for prompt ${promptIndex + 1}`);
          
          const numberOfCalls = Math.ceil(targetImagesPerPrompt / 8);
          let remainingImages = targetImagesPerPrompt;

          for (let i = 0; i < numberOfCalls; i++) {
            const imagesThisCall = Math.min(8, remainingImages);
            remainingImages -= imagesThisCall;
            
            const form = new FormData();
            form.append('prompt[text]', prompt.text);
            form.append('prompt[callback]', `https://www.youphotoshoot.com/api/llm/prompt-webhook?webhook_secret=${webhookSecret}&user_id=${id}&prompt_index=${promptIndex}&is_backup=${isBackupPrompt ? '1' : '0'}`);
            form.append('prompt[num_images]', imagesThisCall.toString());

            console.log(`Sending request for ${imagesThisCall} images for ${isBackupPrompt ? 'backup ' : ''}prompt ${promptIndex + 1}`);

            const response = await fetchWithRetry(API_URL, {
              method: 'POST',
              headers: headers,
              body: form
            });

            const result = await response.json();
            
            if (!result || result.error || !result.id) {
              throw new Error(`Invalid response from Astria API: ${JSON.stringify(result)}`);
            }
            
            result.promptIndex = promptIndex;
            result.isBackup = isBackupPrompt;
            results.push(result);
            pendingPrompts.add(promptIndex);
            console.log(`Successfully queued ${isBackupPrompt ? 'backup ' : ''}prompt ${promptIndex + 1}, attempt ${retryCount + 1}`);
            console.log(`Current pending prompts: ${pendingPrompts.size}`);

            if (i < numberOfCalls - 1 || promptIndex < selectedPrompts.length - 1) {
              const delayTime = DELAY * (isBackupPrompt ? 3 : 2); // Longer delay for backup prompts
              console.log(`Waiting ${delayTime}ms before next API call...`);
              await sleep(delayTime);
            }
          }
          
          success = true;
        } catch (error) {
          console.error(`Error processing ${isBackupPrompt ? 'backup ' : ''}prompt ${promptIndex + 1} (attempt ${retryCount + 1}):`, error);
          retryCount++;
          
          if (retryCount < MAX_RETRIES) {
            const delayTime = RETRY_DELAY * Math.pow(2, retryCount);
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

    // Wait for pending prompts to complete or timeout
    const WAIT_TIMEOUT = isBackupPrompt ? 120000 : 180000; // 2 minutes for backup, 3 minutes for regular
    const startTime = Date.now();
    
    while (pendingPrompts.size > 0 && Date.now() - startTime < WAIT_TIMEOUT) {
      await sleep(5000);
      console.log(`Waiting for ${pendingPrompts.size} ${isBackupPrompt ? 'backup ' : ''}pending prompts...`);
    }

    if (successfulPromptIndexes.size < REQUIRED_PROMPT_COUNT) {
      globalRetryCount++;
      if (globalRetryCount < GLOBAL_MAX_RETRIES) {
        const delayTime = RETRY_DELAY * Math.pow(2, globalRetryCount);
        console.log(`Not all ${isBackupPrompt ? 'backup ' : ''}prompts were successful (${successfulPromptIndexes.size}/${REQUIRED_PROMPT_COUNT}). Starting global retry ${globalRetryCount + 1} in ${delayTime}ms...`);
        await sleep(delayTime);
      }
    }
  }

  console.log(`${isBackupPrompt ? 'Backup prompt' : 'Prompt'} processing summary:`, {
    totalPrompts: selectedPrompts.length,
    successfulPrompts: successfulPromptIndexes.size,
    pendingPrompts: pendingPrompts.size,
    failedPrompts: failedPrompts.length,
    failedDetails: failedPrompts,
    globalRetries: globalRetryCount,
    successfulPromptIndexes: Array.from(successfulPromptIndexes),
    isBackup: isBackupPrompt
  });

  return results;
}

