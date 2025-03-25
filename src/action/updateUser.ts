'use server'

import { createClient } from "@/utils/supabase/server";
import { redirect } from 'next/navigation';

interface UserFormData {
  name?: string;
  age?: string;
  gender?: string;
  userPhotos?: {
    userSelfies?: string[];
  };
  promptsResult?: any[];
  validImageUrls?: string[];
  workStatus?: string;
  hasBeenReviewed?: boolean;
}

export async function updateUser(formData: UserFormData) {
  const supabase = createClient();
  
  // Get the current authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    console.error("No authenticated user found");
    return { error: "User not authenticated" };
  }

  let updatedFormData = { ...formData };

  // If userPhotos is provided, merge it with existing data
  if (formData.userPhotos) {
    const { data: existingData } = await supabase
      .from('userTable')
      .select('userPhotos')
      .eq('id', userId)
      .single();

    updatedFormData.userPhotos = {
      ...existingData?.userPhotos,
      ...formData.userPhotos
    };
  }

  // For validImageUrls field on basic plan, load current values if we need to merge
  if (formData.validImageUrls) {
    console.log(`Updating validImageUrls with ${formData.validImageUrls.length} URLs`);
  }

  // Update the user data in the 'userTable'
  const { data, error } = await supabase
    .from('userTable')
    .update(updatedFormData)
    .eq('id', userId);

  if (error) {
    console.error("Error updating user data in Supabase:", error);
    return { error: "Failed to update user data" };
  }

  console.log("User data updated successfully:", {
    userId,
    hasValidImageUrls: !!formData.validImageUrls,
    validImageUrlsCount: formData.validImageUrls?.length,
    hasPromptsResult: !!formData.promptsResult,
    promptsResultCount: formData.promptsResult?.length,
    workStatus: formData.workStatus,
  });

  // Only redirect if it's not an image upload, promptsResult update, or validImageUrls update
  if (!formData.userPhotos && !formData.promptsResult && !formData.validImageUrls) {
    redirect('/upload/styles');
  }
  
  return { success: true };
}