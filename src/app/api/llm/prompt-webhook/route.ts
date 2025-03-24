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

export async function POST(request: Request) {

  // Parse incoming JSON data as unknown
  const incomingData = await request.json() as unknown;


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
  const getAllowedImages = (planType: string): number => {
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

  try {
    console.log('Incoming webhook data:', JSON.stringify(incomingData, null, 2));

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
    const allowedImages = getAllowedImages(userPlanType);
    const currentImageCount = updatedPromptsResult.reduce((acc, prompt) => 
      acc + (prompt.data?.prompt?.images?.length || 0), 0);

    console.log("User plan type:", userPlanType);
    console.log("Allowed images:", allowedImages);
    console.log("Current image count:", currentImageCount);

    if (currentImageCount > allowedImages) {
      return NextResponse.json(
        {
          message: "Prompt limit exceeded for your plan.",
        },
        { status: 403 }
      );
    }

    // Check if this is the last allowed prompt
    const isLastAllowedPrompt = currentImageCount === allowedImages;

    // Prepare the update object
    const updateObject: { promptsResult: any[]; workStatus?: string } = {
      promptsResult: updatedPromptsResult
    };

    // If current workStatus is "ongoing", change it to "complete"
    if (userData.workStatus === 'ongoing') {
      updateObject.workStatus = 'complete';
      console.log("Work status changed from ongoing to complete");
    }

    console.log("updateObject:", JSON.stringify(updateObject, null, 2));

    // Update promptsResult and potentially workStatus in the database
    const { data: userUpdated, error: userUpdatedError } = await supabase
      .from('userTable')
      .update(updateObject)
      .eq('id', user_id);

    // Log success response
    console.log("Success response:", { message: "success", userId: user_id, userUpdated, isLastAllowedPrompt });
    
    console.log('Current image breakdown:', 
      updatedPromptsResult.map(p => ({
        prompt: p.data.prompt?.id,
        images: p.data.prompt?.images?.length
      }))
    );

    return NextResponse.json(
      {
        message: "Webhook processed successfully"
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      {
        message: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
