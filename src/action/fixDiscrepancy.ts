'use server'

//The purpose of this file is to fix discrepancy

import { getAstriaPrompts } from './getAstriaPrompts';
import { updateUser } from './updateUser';

interface UserData {
  id: string;
  name: string;
  planType: "Basic" | "Professional" | "Executive";
  promptsResult: any[];
  validImageUrls?: string[]; // Add support for the tracked valid image URLs
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
  const isBasicPlan = userData.planType.toLowerCase() === "basic";
  
  // Calculate total images we currently have
  const currentImages = userData.promptsResult?.reduce((total, result) => 
    total + (result.data?.prompt?.images?.length || 0), 0) || 0;
  
  // For basic plan, also check validImageUrls
  const validImagesCount = (isBasicPlan && userData.validImageUrls) ? userData.validImageUrls.length : 0;
  
  console.log("Current image count:", currentImages);
  console.log("Valid tracked images count:", validImagesCount);
  console.log("Plan limit:", planLimit);

  // For basic plan, we need exactly 10 images - check both sources
  const needsImageSync = isBasicPlan
    ? (validImagesCount < 10 && currentImages < planLimit)
    : (currentImages < planLimit);

  if (needsImageSync && userData.apiStatus?.id) {
    try {
      console.log("Fetching prompts from Astria...");
      const astriaPrompts = await getAstriaPrompts(userData.apiStatus.id.toString());
      
      // Log unique images from Astria prompts
      const uniqueAstriaImages = new Set(
        astriaPrompts.flatMap(prompt => prompt.images || [])
      );
      console.log("Total unique Astria images:", uniqueAstriaImages.size);

      // Instead of filtering out existing prompts, update them with latest data
      const updatedPromptsResult = await Promise.all(astriaPrompts.map(async (prompt: Prompt) => {
        // Ensure we're getting all images from each prompt
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

      // For basic plan, extract all valid image URLs and store them separately too
      let validImageUrls: string[] = [];
      
      if (isBasicPlan) {
        // Extract all image URLs from all prompts
        const allImageUrls = filteredPrompts.flatMap(result => 
          result.data.prompt.images.filter(url => 
            typeof url === 'string' && url.startsWith('http')
          )
        );
        
        // Deduplicate and ensure we have at most 10 URLs
        validImageUrls = Array.from(new Set(allImageUrls)).slice(0, 10);
        
        // If we still don't have enough, add in any from the user's existing validImageUrls
        if (validImageUrls.length < 10 && userData.validImageUrls && userData.validImageUrls.length > 0) {
          // Combine existing and new, deduplicate, and cap at 10
          validImageUrls = Array.from(
            new Set([...validImageUrls, ...userData.validImageUrls])
          ).slice(0, 10);
        }
        
        console.log(`Collected ${validImageUrls.length} valid image URLs for basic plan user`);
      }

      // Update user with the filtered prompts and valid image URLs for basic plan
      const updateData: {
        promptsResult: any[];
        validImageUrls?: string[];
      } = {
        promptsResult: filteredPrompts
      };
      
      // Only add validImageUrls for basic plan
      if (isBasicPlan && validImageUrls.length > 0) {
        updateData.validImageUrls = validImageUrls;
      }
      
      await updateUser(updateData);

      const totalImages = filteredPrompts.reduce((total, result) => 
        total + (result.data.prompt.images.length || 0), 0
      );

      console.log("Total images after sync:", totalImages);
      console.log("Total valid tracked images:", validImageUrls.length);
      console.log("Missing images:", planLimit - totalImages);

      // For basic plan, ensure we're returning the full filtered prompts with validImageUrls
      if (isBasicPlan) {
        // Add validImageUrls to the userData we return
        return {
          ...filteredPrompts,
          validImageUrls
        };
      }
      
      return filteredPrompts;
    } catch (error) {
      console.error("Error in fixDiscrepancy:", error);
      throw error; // Propagate the error for better error handling
    }
  }
  
  return userData.promptsResult;
} 
