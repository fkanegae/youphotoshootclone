import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
  // Parse incoming JSON data as unknown
  const incomingData = await request.json() as any;

  // Extract user_id and webhook_secret from the request URL
  const urlObj = new URL(request.url);
  const user_id = urlObj.searchParams.get("user_id");
  const webhook_secret = urlObj.searchParams.get("webhook_secret");

  // Validate webhook parameters
  if (!webhook_secret) {
    return NextResponse.json(
      { message: "Malformed URL, no webhook_secret detected!" },
      { status: 400 }
    );
  }

  if (webhook_secret.toLowerCase() !== appWebhookSecret?.toLowerCase()) {
    return NextResponse.json({ message: "Unauthorized!" }, { status: 401 });
  }

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

  // Function to get user data with retries
  async function getUserData(retryCount = 0): Promise<any> {
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
        return getUserData(retryCount + 1);
      }
      throw error;
    }
  }

  try {
    // Get user data with retries
    const userData = await getUserData();
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

    // Update the incoming data with validated images
    const newPromptResult = {
      timestamp,
      data: {
        ...incomingData,
        prompt: {
          ...incomingData.prompt,
          images: validatedImages
        }
      }
    };

    // Get the current promptsResult array or initialize it
    const currentPromptsResult = Array.isArray(userData.promptsResult) 
      ? userData.promptsResult 
      : [];

    console.log('Current promptsResult:', JSON.stringify(currentPromptsResult, null, 2));

    // Add the new prompt result to the array
    const updatedPromptsResult = [...currentPromptsResult, newPromptResult];

    // Get the user's plan type and check prompt limit
    const userPlanType = userData.planType || 'basic';
    const allowedPrompts = getAllowedPrompts(userPlanType);
    const currentPromptCount = updatedPromptsResult.length;

    console.log("User plan type:", userPlanType);
    console.log("Allowed prompts:", allowedPrompts);
    console.log("Current prompt count:", currentPromptCount);
    console.log("Valid images in this prompt:", validatedImages.length);

    // Calculate total images across all prompts
    const totalImages = updatedPromptsResult.reduce((sum, prompt) => 
      sum + (prompt.data.prompt.images?.length || 0), 0
    );
    console.log("Total images across all prompts:", totalImages);

    if (currentPromptCount > allowedPrompts) {
      return NextResponse.json(
        { message: "Prompt limit exceeded for your plan." },
        { status: 403 }
      );
    }

    // Check if this is the last allowed prompt
    const isLastAllowedPrompt = currentPromptCount === allowedPrompts;

    // Prepare the update object
    const updateObject: { promptsResult: any[]; workStatus?: string } = {
      promptsResult: updatedPromptsResult
    };

    // Update work status if needed
    if (userData.workStatus === 'ongoing' && isLastAllowedPrompt) {
      updateObject.workStatus = 'complete';
      console.log("Work status changed from ongoing to complete");
    }

    // Update database with retries
    const userUpdated = await updateUserData(supabase, user_id, updateObject);

    // Log success response with detailed information
    const responseData = {
      message: "Webhook Callback Success!",
      userId: user_id,
      promptCount: currentPromptCount,
      totalImages,
      validImagesInThisPrompt: validatedImages.length,
      isLastAllowedPrompt,
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