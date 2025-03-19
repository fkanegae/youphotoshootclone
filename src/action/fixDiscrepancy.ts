'use server'

//The purpose of this file is to fix discrepancy

import { getAstriaPrompts } from './getAstriaPrompts';
import { updateUser } from './updateUser';

interface UserData {
  id: string;
  name: string;
  planType: "Basic" | "Professional" | "Executive";
  promptsResult: any[];
  apiStatus: {
    id: number;
  };
}

interface Prompt {
  id: number;
  text: string;
  images: string[];
  steps?: number | null;
  tune_id?: number;
  created_at?: string;
  trained_at?: string;
  updated_at?: string;
  negative_prompt?: string;
  started_training_at?: string;
  callback?: string;
}

async function getFinalImageUrl(redirectUrl: string): Promise<string> {
  try {
    const response = await fetch(redirectUrl, {
      redirect: 'follow',
      method: 'HEAD'
    });
    return response.url;
  } catch (error) {
    console.error('Error resolving image URL:', error);
    return redirectUrl; // Fallback to original URL if resolution fails
  }
}

export async function fixDiscrepancy(userData: UserData | null) {
  if (!userData) {
    console.log("No user data available to fix discrepancy");
    return;
  }

  const getPlanLimit = (planType: string) => {
    switch (planType.toLowerCase()) {
      case "basic":
        return 10;
      case "professional":
        return 100;
      case "executive":
        return 200;
      default:
        return 0;
    }
  };

  const planLimit = getPlanLimit(userData.planType);
  
  // Calculate total images we currently have
  const currentImages = userData.promptsResult?.reduce((total, result) => 
    total + (result.data?.prompt?.images?.length || 0), 0) || 0;
  
  console.log("Current image count:", currentImages);
  console.log("Plan limit:", planLimit);
  console.log("Current prompts:", JSON.stringify(userData.promptsResult.map(p => ({
    id: p.data?.prompt?.id,
    text: p.data?.prompt?.text,
    imageCount: p.data?.prompt?.images?.length || 0
  })), null, 2));

  if (currentImages < planLimit && userData.apiStatus?.id) {
    let retryCount = 0;
    const MAX_RETRIES = 5; // Increased from 3 to 5
    const RETRY_DELAY = 2000; // 2 seconds
    const MAX_FETCH_ATTEMPTS = 3; // Maximum attempts to fetch each image URL

    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`Fetching prompts from Astria (attempt ${retryCount + 1})...`);
        const astriaPrompts = await getAstriaPrompts(userData.apiStatus.id.toString());
        
        // Log unique images from Astria prompts
        const uniqueAstriaImages = new Set(
          astriaPrompts.flatMap(prompt => prompt.images || [])
        );
        console.log("Total unique Astria images:", uniqueAstriaImages.size);
        
        // Log detailed prompt information
        console.log("Astria prompts details:", JSON.stringify(astriaPrompts.map(p => ({
          id: p.id,
          text: p.text,
          imageCount: p.images?.length || 0,
          hasImages: !!p.images && p.images.length > 0
        })), null, 2));

        // Track which prompts we've processed
        const processedPromptIds = new Set();

        // We'll try to get images even if we don't have the full count yet
        const updatedPromptsResult = await Promise.all(astriaPrompts.map(async (prompt: Prompt) => {
          if (!prompt.images || prompt.images.length === 0) {
            console.log(`No images found for prompt ${prompt.id} with text: ${prompt.text}`);
            return null;
          }

          // Try to resolve each image URL with multiple attempts
          const resolvedImages = await Promise.all(
            prompt.images.map(async (url) => {
              for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt++) {
                try {
                  const resolvedUrl = await getFinalImageUrl(url);
                  if (resolvedUrl) {
                    return resolvedUrl;
                  }
                  console.log(`Failed to resolve URL ${url} on attempt ${attempt + 1}, retrying...`);
                  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between attempts
                } catch (error) {
                  console.error(`Error resolving URL ${url} on attempt ${attempt + 1}:`, error);
                  if (attempt < MAX_FETCH_ATTEMPTS - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }
              }
              console.error(`Failed to resolve URL ${url} after ${MAX_FETCH_ATTEMPTS} attempts`);
              return null;
            })
          );
          
          const validImages = resolvedImages.filter(Boolean);
          console.log(`Prompt ${prompt.id}: ${validImages.length}/${prompt.images.length} images resolved successfully`);
          
          if (validImages.length === 0) {
            console.log(`All images failed to resolve for prompt ${prompt.id}`);
            return null;
          }

          processedPromptIds.add(prompt.id);
          
          return {
            data: {
              prompt: {
                id: prompt.id,
                text: prompt.text,
                steps: prompt.steps,
                images: validImages,
                tune_id: prompt.tune_id,
                created_at: prompt.created_at,
                trained_at: prompt.trained_at,
                updated_at: prompt.updated_at,
                negative_prompt: prompt.negative_prompt,
                started_training_at: prompt.started_training_at
              }
            },
            timestamp: new Date().toISOString()
          };
        }));

        // Filter out any null results and empty prompts
        const filteredPrompts = updatedPromptsResult.filter((result): result is NonNullable<typeof result> => 
          result !== null && result.data.prompt.images.length > 0
        );

        // Calculate total images after filtering
        const totalFilteredImages = filteredPrompts.reduce((total, result) => 
          total + result.data.prompt.images.length, 0
        );

        console.log("Filtered prompts summary:", JSON.stringify(filteredPrompts.map(p => ({
          id: p.data.prompt.id,
          text: p.data.prompt.text,
          imageCount: p.data.prompt.images.length
        })), null, 2));

        // Log any prompts that weren't processed
        const missingPromptIds = astriaPrompts
          .filter(p => !processedPromptIds.has(p.id))
          .map(p => ({ id: p.id, text: p.text }));
        
        if (missingPromptIds.length > 0) {
          console.log("Missing prompts:", missingPromptIds);
        }

        if (totalFilteredImages >= planLimit) {
          // We have enough valid images, update the user
          await updateUser({
            promptsResult: filteredPrompts
          });
          console.log(`Successfully updated user with ${totalFilteredImages} images`);
          return filteredPrompts;
        } else {
          console.log(`Not enough valid images after filtering: ${totalFilteredImages}/${planLimit}`);
          // If we have some images but not enough, we'll keep retrying
          if (totalFilteredImages > 0) {
            await updateUser({
              promptsResult: filteredPrompts
            });
            console.log(`Updated user with partial results: ${totalFilteredImages} images`);
          }
        }

        // If we don't have enough images, retry
        console.log(`Not enough images (${uniqueAstriaImages.size}/${planLimit}), retrying...`);
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          const delayTime = RETRY_DELAY * Math.pow(2, retryCount - 1); // Exponential backoff
          console.log(`Waiting ${delayTime}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delayTime));
        }
      } catch (error) {
        console.error(`Error in attempt ${retryCount + 1}:`, error);
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          const delayTime = RETRY_DELAY * Math.pow(2, retryCount - 1);
          console.log(`Waiting ${delayTime}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delayTime));
        }
      }
    }

    console.error(`Failed to get enough images after ${MAX_RETRIES} attempts`);
    return null;
  }

  return null;
} 
