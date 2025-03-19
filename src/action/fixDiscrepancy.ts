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

  if (currentImages < planLimit && userData.apiStatus?.id) {
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`Fetching prompts from Astria (attempt ${retryCount + 1})...`);
        const astriaPrompts = await getAstriaPrompts(userData.apiStatus.id.toString());
        
        // Log unique images from Astria prompts
        const uniqueAstriaImages = new Set(
          astriaPrompts.flatMap(prompt => prompt.images || [])
        );
        console.log("Total unique Astria images:", uniqueAstriaImages.size);

        if (uniqueAstriaImages.size >= planLimit) {
          // We have enough images, process them
          const updatedPromptsResult = await Promise.all(astriaPrompts.map(async (prompt: Prompt) => {
            if (!prompt.images || prompt.images.length === 0) {
              console.log(`No images found for prompt ${prompt.id}`);
              return null;
            }

            const resolvedImages = await Promise.all(
              prompt.images.map(getFinalImageUrl)
            );
            
            if (resolvedImages.some(url => !url)) {
              console.log(`Some images failed to resolve for prompt ${prompt.id}`);
            }
            
            return {
              data: {
                prompt: {
                  id: prompt.id,
                  text: prompt.text,
                  steps: prompt.steps,
                  images: resolvedImages.filter(Boolean), // Remove any failed URLs
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

          if (totalFilteredImages >= planLimit) {
            // We have enough valid images, update the user
            await updateUser({
              promptsResult: filteredPrompts
            });
            console.log(`Successfully updated user with ${totalFilteredImages} images`);
            return filteredPrompts;
          }
        }

        // If we don't have enough images, retry
        console.log(`Not enough images (${uniqueAstriaImages.size}/${planLimit}), retrying...`);
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      } catch (error) {
        console.error(`Error in attempt ${retryCount + 1}:`, error);
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }

    console.error(`Failed to get enough images after ${MAX_RETRIES} attempts`);
    return null;
  }

  return null;
} 
