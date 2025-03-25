import getUser from "@/action/getUser";
import ImageGallery from "./ImageGallery";
import { redirect } from "next/navigation";
import Header from "@/components/Header";

export default async function DashboardPage() {
  const userData = await getUser();

  // Check if workStatus is ongoing and redirect if true
  if (userData?.[0]?.workStatus === "ongoing") {
    redirect("/wait");
  }

  const downloadHistory = userData?.[0]?.downloadHistory || [];
  const userPlanType = userData?.[0]?.planType?.toLowerCase() || 'basic';
  
  let imageUrls: string[] = [];
  const promptsResult = userData?.[0]?.promptsResult || [];

  // For basic plan users, prioritize the validImageUrls field which guarantees 10 images
  if (userPlanType === 'basic' && Array.isArray(userData?.[0]?.validImageUrls) && userData?.[0]?.validImageUrls.length > 0) {
    console.log("Using validImageUrls for basic plan user with", userData?.[0]?.validImageUrls.length, "images");
    imageUrls = userData?.[0]?.validImageUrls;
  } else {
    // Extract image URLs from promptsResult for other plans
    if (promptsResult.length > 0) {
      imageUrls = promptsResult.flatMap(
        (result: { data?: { prompt?: { images: string[] } } }) =>
          result.data?.prompt?.images || []
      );
    }
    
    // Log information about extracted images
    console.log("Extracted", imageUrls.length, "images from promptsResult for", userPlanType, "plan");
  }

  return (
    <main className="min-h-screen bg-mainWhite flex flex-col">
      <Header userAuth={true} backDashboard={true} />
      <section className="flex-grow p-4">
        <ImageGallery
          images={imageUrls}
          downloadHistory={downloadHistory}
          userData={userData?.[0]} // Pass userData to ImageGallery
        />
      </section>
    </main>
  );
}
