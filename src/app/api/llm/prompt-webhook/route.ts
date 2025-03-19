import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createPrompt } from "../prompt/createPrompt";
export const dynamic = "force-dynamic";

// Environment variables for Supabase and webhook secret
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appWebhookSecret = process.env.APP_WEBHOOK_SECRET;

// Check for required environment variables
if (!supabaseUrl) {
  throw new Error("MISSING NEXT_PUBLIC_SUPABASE_URL!");
}

if (!supabaseServiceRoleKey) {
  throw new Error("MISSING SUPABASE_SERVICE_ROLE_KEY!");
}

if (!appWebhookSecret) {
  throw new Error("MISSING APP_WEBHOOK_SECRET!");
}

// Constants for retry mechanism
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Helper function to validate image URLs
async function validateImageUrls(images: string[]): Promise<string[]> {
  const validImages = await Promise.all(
    images.map(async (url) => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok ? url : null;
      } catch (error) {
        console.error(`Error validating image URL ${url}:`, error);
        return null;
      }
    })
  );
  return validImages.filter((url): url is string => url !== null);
}

// Helper function to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to get allowed prompts based on plan type
function getAllowedPrompts(planType: string): number {
  switch (planType.toLowerCase()) {
    case 'professional':
      return 100;
    case 'executive':
      return 200;
    case 'basic':
    default:
      return 10;
  }
}

// Helper function to update user data with retries
async function updateUserData(supabase: any, user_id: string, updateObject: any, retryCount = 0) {
  try {
    const { data: userUpdated, error: userUpdatedError } = await supabase
      .from('userTable')
      .update(updateObject)
      .eq('id', user_id);

    if (userUpdatedError) throw userUpdatedError;
    return userUpdated;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying updateUserData (${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY * Math.pow(2, retryCount));
      return updateUserData(supabase, user_id, updateObject, retryCount + 1);
    }
    throw error;
  }
}

// Interface for prompt result
interface PromptResult {
  timestamp: string;
  promptIndex: number;
  data: {
    prompt: {
      id: number;
      text: string;
      images: string[];
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export async function POST(request: Request) {
  // Parse incoming JSON data
  const incomingData = await request.json() as any;

  // Extract parameters from the request URL
  const urlObj = new URL(request.url);
  const user_id = urlObj.searchParams.get("user_id");
  const webhook_secret = urlObj.searchParams.get("webhook_secret");
  const prompt_index = urlObj.searchParams.get("prompt_index");

  // Enhanced validation
  if (!webhook_secret || !user_id || prompt_index === null) {
    console.error('Missing required parameters:', { webhook_secret, user_id, prompt_index });
    return NextResponse.json(
      { message: "Missing required parameters" },
      { status: 400 }
    );
  }

  if (webhook_secret.toLowerCase() !== appWebhookSecret?.toLowerCase()) {
    return NextResponse.json({ message: "Unauthorized!" }, { status: 401 });
  }

  // Create a Supabase client
  const supabase = createClient(
    supabaseUrl as string,
    supabaseServiceRoleKey as string,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );

  // Function to get user data with retries
  async function getUserData(supabase: any, user_id: string, retryCount = 0): Promise<any> {
    try {
      const { data: userData, error: userError } = await supabase
        .from('userTable')
        .select('*')
        .eq('id', user_id)
        .single();

      if (userError) throw userError;
      if (!userData) throw new Error('User not found');
      
      return userData;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying getUserData (${retryCount + 1}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY * Math.pow(2, retryCount));
        return getUserData(supabase, user_id, retryCount + 1);
      }
      throw error;
    }
  }

  try {
    // Get user data with retries
    const userData = await getUserData(supabase, user_id);
    console.log('User data from userTable:', JSON.stringify(userData, null, 2));

    const timestamp = new Date().toISOString();
    
    // Validate incoming data has images
    if (!incomingData?.prompt?.images || !Array.isArray(incomingData.prompt.images)) {
      console.error('Invalid webhook data - missing or invalid images array:', incomingData);
      return NextResponse.json(
        { message: "Invalid webhook data - missing images" },
        { status: 400 }
      );
    }

    // Validate image URLs
    const validatedImages = await validateImageUrls(incomingData.prompt.images);
    if (validatedImages.length === 0) {
      console.error('No valid images found in webhook data');
      return NextResponse.json(
        { message: "No valid images in webhook data" },
        { status: 400 }
      );
    }

    // Get the current promptsResult array or initialize it
    const currentPromptsResult = Array.isArray(userData.promptsResult) 
      ? userData.promptsResult 
      : [];

    // Create new prompt result with validated images and prompt index
    const newPromptResult = {
      timestamp,
      promptIndex: parseInt(prompt_index),
      data: {
        ...incomingData,
        prompt: {
          ...incomingData.prompt,
          images: validatedImages
        }
      }
    };

    // Check if we already have a result for this prompt index
    const existingIndex = currentPromptsResult.findIndex(
      (result: PromptResult) => result.promptIndex === parseInt(prompt_index)
    );

    let updatedPromptsResult;
    if (existingIndex >= 0) {
      // Update existing prompt result
      updatedPromptsResult = [...currentPromptsResult];
      updatedPromptsResult[existingIndex] = newPromptResult;
    } else {
      // Add new prompt result
      updatedPromptsResult = [...currentPromptsResult, newPromptResult];
    }

    // Get the user's plan type and calculate limits
    const userPlanType = userData.planType || 'basic';
    const allowedPrompts = getAllowedPrompts(userPlanType);
    const targetImagesPerPrompt = userPlanType === "basic" ? 1 
      : userPlanType === "professional" ? 10 
      : userPlanType === "executive" ? 20 
      : 1;

    // Calculate total required images
    const totalRequiredImages = allowedPrompts * targetImagesPerPrompt;

    // Calculate current totals
    const uniquePromptIndexes = new Set(updatedPromptsResult.map(r => r.promptIndex));
    const totalPrompts = uniquePromptIndexes.size;
    const totalImages = updatedPromptsResult.reduce((sum, prompt) => 
      sum + (prompt.data.prompt.images?.length || 0), 0
    );

    console.log('Progress update:', {
      promptIndex: prompt_index,
      totalPrompts,
      totalImages,
      requiredPrompts: allowedPrompts,
      requiredImages: totalRequiredImages,
      validImagesInThisPrompt: validatedImages.length
    });

    // Prepare the update object
    const updateObject: { 
      promptsResult: any[]; 
      workStatus?: string;
      backupPromptsTriggered?: boolean 
    } = {
      promptsResult: updatedPromptsResult
    };

    // More aggressive workStatus update - if we have any images and status is ongoing, mark as partial
    if (userData.workStatus === 'ongoing') {
      // Always update workStatus if we have any images
      if (totalImages > 0) {
        updateObject.workStatus = totalImages >= totalRequiredImages ? 'complete' : 'partial';
        console.log(`Updating workStatus to ${updateObject.workStatus}. Images: ${totalImages}/${totalRequiredImages}`);
      }
      
      // Log detailed status for debugging
      console.log('Current status:', {
        currentWorkStatus: userData.workStatus,
        hasImages: totalImages > 0,
        totalImages,
        requiredImages: totalRequiredImages,
        promptsReceived: totalPrompts,
        uniquePromptIndexes: Array.from(uniquePromptIndexes),
        updatingTo: updateObject.workStatus || 'no change'
      });
    }

    // Check if we need to generate backup prompts
    const BACKUP_THRESHOLD_TIME = 60000; // 1 minute
    const shouldTriggerBackup = 
      userData.workStatus === 'ongoing' && 
      totalImages < totalRequiredImages && 
      !userData.backupPromptsTriggered && 
      Date.now() - new Date(userData.updatedAt).getTime() > BACKUP_THRESHOLD_TIME;

    if (shouldTriggerBackup) {
      console.log('Triggering backup prompts due to insufficient images:', {
        currentImages: totalImages,
        requiredImages: totalRequiredImages
      });

      try {
        // Mark that we've triggered backup prompts to prevent multiple triggers
        await updateUserData(supabase, user_id, {
          ...updateObject,
          backupPromptsTriggered: true
        });

        // Create 5 more prompts
        const backupResult = await createPrompt([{
          ...userData,
          isBackupPrompt: true, // Flag to indicate these are backup prompts
          backupCount: 5 // Number of backup prompts to generate
        }]);

        console.log('Backup prompts created:', backupResult);
      } catch (error) {
        console.error('Error creating backup prompts:', error);
        // Don't throw the error - we still want to process the current webhook
      }
    }

    // Update database with retries
    const userUpdated = await updateUserData(supabase, user_id, updateObject);

    // Prepare response data
    const responseData = {
      message: "Webhook Callback Success!",
      userId: user_id,
      promptIndex: prompt_index,
      totalPrompts,
      totalImages,
      requiredPrompts: allowedPrompts,
      requiredImages: totalRequiredImages,
      isComplete: totalPrompts >= allowedPrompts && totalImages >= totalRequiredImages,
      workStatus: updateObject.workStatus || userData.workStatus
    };
    
    console.log("Success response:", JSON.stringify(responseData, null, 2));
    return NextResponse.json(responseData, { status: 200 });
  } catch (e) {
    console.error('Error processing webhook:', e);
    return NextResponse.json(
      { message: "Something went wrong!", error: String(e) },
      { status: 500 }
    );
  }
}

// Example of userData field promptsResult
// {
//   "2024-09-29T16:16:07.635Z": {
//     "prompt": {
//       "id": 18609859,
//       "text": "<lora:1661944:1.0>ohwx man in the style of communist",
//       "steps": null,
//       "images": [
//         "https://sdbooth2-production.s3.amazonaws.com/sb806vy5dbscmkmy649106cum8eb",
//         "https://sdbooth2-production.s3.amazonaws.com/982c8f6fb6m005bjidz3hiv1k8k1",
//         "https://sdbooth2-production.s3.amazonaws.com/cga5sxuexi7ykiozybj5iltwkeg1",
//         "https://sdbooth2-production.s3.amazonaws.com/1ukl6poc8zcnj8l0j2u5sfse7mfz"
//       ],
//       "tune_id": 1504944,
//       "created_at": "2024-09-29T16:00:43.046Z",
//       "trained_at": "2024-09-29T16:16:06.539Z",
//       "updated_at": "2024-09-29T16:16:06.677Z",
//       "negative_prompt": "",
//       "started_training_at": "2024-09-29T16:13:55.014Z"
//     }
//   }
// }