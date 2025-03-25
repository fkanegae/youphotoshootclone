import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// Environment variables for Supabase and webhook secret1
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // Supabase URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Supabase service role key
const appWebhookSecret = process.env.APP_WEBHOOK_SECRET; // Webhook secret for authentication

// Check for required environment variables
if (!supabaseUrl) {
  throw new Error("MISSING NEXT_PUBLIC_SUPABASE_URL!"); // Error if Supabase URL is missing
}

if (!supabaseServiceRoleKey) {
  throw new Error("MISSING SUPABASE_SERVICE_ROLE_KEY!"); // Error if service role key is missing
}

if (!appWebhookSecret) {
  throw new Error("MISSING APP_WEBHOOK_SECRET!"); // Error if webhook secret is missing
}

// Define the type for the prompt response
type PromptResponse = {
  prompt?: {
    id?: number;
    text?: string;
    steps?: any;
    images?: string[];
    tune_id?: number;
    created_at?: string;
    trained_at?: string;
    updated_at?: string;
    negative_prompt?: string;
    started_training_at?: string;
  };
  [key: string]: any;
};

// A tracking object to store which prompts we've received
// This helps prevent webhook duplication and missing images
const processedPromptIds = new Map<string, Set<number>>();
const COMPLETION_CHECK_DELAY = 30000; // 30 seconds

export async function POST(request: Request) {
  // Parse incoming JSON data with the correct type
  const incomingData = await request.json() as PromptResponse;

  // Extract user_id and webhook_secret from the request URL
  const urlObj = new URL(request.url);
  const user_id = urlObj.searchParams.get("user_id");
  const webhook_secret = urlObj.searchParams.get("webhook_secret");

  // Check for webhook_secret in the URL
  if (!webhook_secret) {
    return NextResponse.json(
      { message: "Malformed URL, no webhook_secret detected!" },
      { status: 400 }
    );
  }

  // Validate the webhook_secret against the stored secret
  if (webhook_secret.toLowerCase() !== appWebhookSecret?.toLowerCase()) {
    return NextResponse.json({ message: "Unauthorized!" }, { status: 401 });
  }

  // Check for user_id in the URL
  if (!user_id) {
    return NextResponse.json(
      { message: "Malformed URL, no user_id detected!" },
      { status: 400 }
    );
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

  // Fetch user data from the custom userTable
  const { data: userData, error: userError } = await supabase
    .from('userTable')
    .select('*')
    .eq('id', user_id)
    .single();

  // Add debug logging for user data
  console.log('User data from userTable:', JSON.stringify(userData, null, 2));

  // Handle errors in fetching user
  if (userError) {
    console.error('Error fetching user from userTable:', userError);
    return NextResponse.json(
      {
        message: userError.message,
      },
      { status: 401 }
    );
  }

  // Check if user exists
  if (!userData) {
    console.log('User not found in userTable');
    return NextResponse.json(
      {
        message: "Unauthorized",
      },
      { status: 401 }
    );
  }

  // Update this function to return different values based on plan type
  const getAllowedPrompts = (planType: string): number => {
    switch (planType.toLowerCase()) {
      case 'professional':
        return 100;
      case 'executive':
        return 200;
      case 'basic':
      default:
        return 10;
    }
  };

  // Enhanced function to count actual images received and validate image URLs
  const validateAndCountImages = (promptsResult: any[]): { 
    totalImages: number, 
    brokenImageUrls: number,
    validImageUrls: string[]
  } => {
    let totalImages = 0;
    let brokenImageUrls = 0;
    const validImageUrls: string[] = [];
    
    if (!promptsResult || !Array.isArray(promptsResult)) {
      return { totalImages: 0, brokenImageUrls: 0, validImageUrls: [] };
    }
    
    for (const result of promptsResult) {
      if (result && result.data && result.data.prompt && Array.isArray(result.data.prompt.images)) {
        // Count total images
        totalImages += result.data.prompt.images.length;
        
        // Check each image URL and collect valid ones
        for (const imageUrl of result.data.prompt.images) {
          if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
            validImageUrls.push(imageUrl);
          } else {
            brokenImageUrls++;
            console.warn(`Broken image URL detected: ${imageUrl}`);
          }
        }
      }
    }
    
    return { totalImages, brokenImageUrls, validImageUrls };
  };

  try {
    console.log('Incoming webhook data:', JSON.stringify(incomingData, null, 2));

    // Check for duplicate webhook calls (same prompt ID)
    const promptId = incomingData?.prompt?.id;
    if (promptId) {
      // Initialize tracking for this user if not exists
      if (!processedPromptIds.has(user_id)) {
        processedPromptIds.set(user_id, new Set());
      }
      
      // Check if we've already processed this prompt ID
      const userPrompts = processedPromptIds.get(user_id);
      if (userPrompts?.has(promptId)) {
        console.warn(`Duplicate webhook call detected for prompt ID ${promptId}`);
        return NextResponse.json(
          { message: "Duplicate webhook call detected and ignored" },
          { status: 200 }
        );
      }
      
      // Mark this prompt as processed
      userPrompts?.add(promptId);
    }

    // Validate that the incoming data has images
    let hasImages = false;
    if (incomingData && 
        incomingData.prompt && 
        incomingData.prompt.images && 
        Array.isArray(incomingData.prompt.images) && 
        incomingData.prompt.images.length > 0) {
      hasImages = true;
    }

    // Log if no images were found
    if (!hasImages) {
      console.warn('WARNING: No images found in webhook data.');
      
      // For basic plan, this is critical - retry or alert
      if (userData.planType === 'basic') {
        // We'll still continue but log a more severe warning
        console.error('CRITICAL: Basic plan webhook received with no images!');
      }
    }

    const timestamp = new Date().toISOString();
    const newPromptResult = { timestamp, data: incomingData };

    // Get the current promptsResult array or initialize it if it doesn't exist
    const currentPromptsResult = Array.isArray(userData.promptsResult) 
      ? userData.promptsResult 
      : [];

    console.log('Current promptsResult:', JSON.stringify(currentPromptsResult, null, 2));

    // Add the new prompt result to the array
    const updatedPromptsResult = [...currentPromptsResult, newPromptResult];

    console.log('Updated promptsResult:', JSON.stringify(updatedPromptsResult, null, 2));

    // Get the user's plan type and check prompt limit
    const userPlanType = userData.planType || 'basic';
    const allowedPrompts = getAllowedPrompts(userPlanType);
    const currentPromptCount = updatedPromptsResult.length;
    
    // Enhanced validation of images
    const { totalImages, brokenImageUrls, validImageUrls } = validateAndCountImages(updatedPromptsResult);

    console.log("User plan type:", userPlanType);
    console.log("Allowed prompts:", allowedPrompts);
    console.log("Current prompt count:", currentPromptCount);
    console.log("Total images received:", totalImages);
    console.log("Valid image URLs:", validImageUrls.length);
    console.log("Broken image URLs:", brokenImageUrls);

    // For basic plan users, ensure we track image URLs specifically
    if (userPlanType === 'basic') {
      // Store a deduplicated list of valid image URLs for basic plan users
      // This ensures users always have access to their 10 images even if webhooks are out of order
      const existingImageUrls = userData.validImageUrls || [];
      
      // Use Array.from for deduplication to avoid Set iteration issues
      const allUrls = [...existingImageUrls, ...validImageUrls];
      const combinedImageUrls = Array.from(new Set(allUrls));
      
      // Log the tracking of valid images
      console.log(`Basic plan user has ${combinedImageUrls.length} tracked valid images URLs (previously ${existingImageUrls.length})`);
      
      // If too many images, trim to the first 10 (for basic plan)
      if (combinedImageUrls.length > 10 && userPlanType === 'basic') {
        console.warn(`Trimming ${combinedImageUrls.length} images to 10 for basic plan`);
        combinedImageUrls.length = 10;
      }
      
      // Update userData with the validImageUrls field
      userData.validImageUrls = combinedImageUrls;
    }

    // For basic plan, ensure we're getting exactly 10 images
    if (userPlanType === 'basic') {
      const validTrackedImageCount = userData.validImageUrls ? userData.validImageUrls.length : 0;
      
      if (validTrackedImageCount > 10) {
        console.warn(`Basic plan user has ${validTrackedImageCount} valid tracked images, exceeding the limit of 10`);
        // Trim to exactly 10
        userData.validImageUrls = userData.validImageUrls.slice(0, 10);
      } else if (validTrackedImageCount < 10 && currentPromptCount >= 10) {
        console.warn(`CRITICAL: Basic plan user has only ${validTrackedImageCount} valid tracked images after receiving ${currentPromptCount} prompts`);
        
        // Do not mark as complete, as we don't have enough images
        // We'll wait for more webhooks or use the scheduled check
      }
    }

    if (currentPromptCount > allowedPrompts) {
      return NextResponse.json(
        {
          message: "Prompt limit exceeded for your plan.",
        },
        { status: 403 }
      );
    }

    // Check if this is the last allowed prompt or if we've reached image count required
    let isComplete = false;
    
    if (userPlanType === 'basic') {
      // For basic plan, check if we have received at least 10 valid tracked images
      const validTrackedImageCount = userData.validImageUrls ? userData.validImageUrls.length : 0;
      isComplete = validTrackedImageCount >= 10;
    } else {
      // For other plans, check if we've received all prompts
      isComplete = currentPromptCount >= allowedPrompts;
    }

    // Prepare the update object - now including the validImageUrls field for basic plan
    const updateObject: { 
      promptsResult: any[]; 
      workStatus?: string;
      validImageUrls?: string[];
      hasBeenReviewed?: boolean;
    } = {
      promptsResult: updatedPromptsResult
    };
    
    // For basic plan, add validImageUrls to track separately
    if (userPlanType === 'basic' && userData.validImageUrls) {
      updateObject.validImageUrls = userData.validImageUrls;
    }

    // If current workStatus is "ongoing" and we've processed all prompts, change it to "complete"
    if (userData.workStatus === 'ongoing' && isComplete) {
      updateObject.workStatus = 'complete';
      // Also mark that we've reviewed the results (for basic plan)
      updateObject.hasBeenReviewed = true;
      console.log("Work status changed from ongoing to complete");
    }

    console.log("updateObject:", JSON.stringify(updateObject, null, 2));

    // Update promptsResult and potentially workStatus in the database
    const { data: userUpdated, error: userUpdatedError } = await supabase
      .from('userTable')
      .update(updateObject)
      .eq('id', user_id);

    if (userUpdatedError) {
      console.error('Error updating user:', userUpdatedError);
      return NextResponse.json(
        {
          message: "Error updating user data",
        },
        { status: 500 }
      );
    }

    // For basic plan, schedule a final check after all expected webhooks to ensure we got 10 images
    if (userPlanType === 'basic' && currentPromptCount >= 9 && !isComplete) {
      // After 30 seconds, check if we have all 10 images
      setTimeout(async () => {
        try {
          console.log(`Running scheduled completion check for user ${user_id}`);
          
          // Fetch the latest user data
          const { data: latestUserData, error: latestUserError } = await supabase
            .from('userTable')
            .select('*')
            .eq('id', user_id)
            .single();
            
          if (latestUserError || !latestUserData) {
            console.error(`Error fetching latest user data in scheduled check: ${latestUserError?.message}`);
            return;
          }
          
          // Check if they're already complete
          if (latestUserData.workStatus === 'complete') {
            console.log(`User ${user_id} is already marked as complete`);
            return;
          }
          
          // Validate the images
          const validImageUrls = latestUserData.validImageUrls || [];
          const promptResults = latestUserData.promptsResult || [];
          const { totalImages, validImageUrls: freshValidUrls } = validateAndCountImages(promptResults);
          
          // Combine with any newly found valid URLs using Array.from to avoid Set iteration issues
          const allUrls = [...validImageUrls, ...freshValidUrls];
          const combinedUrls = Array.from(new Set(allUrls));
          
          console.log(`Scheduled check found ${combinedUrls.length} valid image URLs`);
          
          // If we have enough images, mark as complete
          if (combinedUrls.length >= 10) {
            // Trim to exactly 10 for basic plan
            combinedUrls.length = 10;
            
            const finalUpdate = {
              validImageUrls: combinedUrls,
              workStatus: 'complete',
              hasBeenReviewed: true
            };
            
            const { error: finalUpdateError } = await supabase
              .from('userTable')
              .update(finalUpdate)
              .eq('id', user_id);
              
            if (finalUpdateError) {
              console.error(`Error in final update: ${finalUpdateError.message}`);
            } else {
              console.log(`Successfully marked user ${user_id} as complete with ${combinedUrls.length} images`);
            }
          } else {
            console.warn(`CRITICAL: Still only have ${combinedUrls.length}/10 images for basic plan user ${user_id} after scheduled check`);
          }
        } catch (error) {
          console.error(`Error in scheduled completion check: ${error}`);
        }
      }, COMPLETION_CHECK_DELAY);
    }

    // Log success response
    console.log("Success response:", { 
      message: "success", 
      userId: user_id, 
      userUpdated, 
      isComplete,
      currentPromptCount,
      totalImages,
      validImageCount: userPlanType === 'basic' ? 
        (userData.validImageUrls ? userData.validImageUrls.length : 0) : 
        validImageUrls.length
    });
    
    return NextResponse.json(
      {
        message: `Webhook Callback Success! User ID: ${user_id}, User Updated: ${userUpdated ? 'Yes' : 'No'}, Complete: ${isComplete}, Images: ${
          userPlanType === 'basic' ? 
            (userData.validImageUrls ? userData.validImageUrls.length : 0) : 
            totalImages
        }/${userPlanType === 'basic' ? 10 : allowedPrompts}`,
      },
      { status: 200, statusText: "Success" }
    );
  } catch (e) {
    console.error('Error processing webhook:', e);
    return NextResponse.json(
      {
        message: "Something went wrong!",
      },
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