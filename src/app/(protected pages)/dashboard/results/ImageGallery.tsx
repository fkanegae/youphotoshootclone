"use client";

import Image from "next/image";
import { trackDownload } from "@/action/trackDownload";
import React, { useState, useEffect, useMemo } from "react";
import { fixDiscrepancy } from "@/action/fixDiscrepancy";

interface ImageGalleryProps {
  images: string[];
  downloadHistory: string[];
  userData: {
    id: string;
    name: string;
    planType: "Basic" | "Professional" | "Executive";
    promptsResult: any[]; // Array of generated images
    validImageUrls?: string[]; // Added field for tracked valid image URLs
    apiStatus: {
      id: number;
      // ... other fields
    };
  } | null;
}

export default function ImageGallery({
  images,
  downloadHistory: initialDownloadHistory,
  userData,
}: ImageGalleryProps) {
  const [downloadHistory, setDownloadHistory] = useState(
    initialDownloadHistory
  );
  const [promptsResult, setPromptsResult] = useState(
    userData?.promptsResult || []
  );
  const [isLoading, setIsLoading] = useState(true);
  
  // Track validImageUrls from userData
  const [validImageUrls, setValidImageUrls] = useState<string[]>(
    userData?.validImageUrls || []
  );

  const handleDownload = async (index: number) => {
    const imageUrl = displayImages[index];
    const result = await trackDownload(imageUrl, userData);

    if (result.success && result.downloadHistory) {
      setDownloadHistory(result.downloadHistory);
    } else if (!result.success) {
      console.error("Download tracking failed:", result.error);
    }

    try {
      const blob = await fetch(imageUrl).then((response) => response.blob());
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const promptId = promptsResult[index]?.data?.prompt?.id;
      const filename = promptId
        ? `ai-headshot-${promptId}-${index + 1}.png`
        : `ai-generated-image-${index + 1}.png`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading image:", error);
    }
  };

  // Calculate remaining headshots
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

  const planLimit = userData ? getPlanLimit(userData.planType) : 0;
  const isBasicPlan = userData?.planType.toLowerCase() === 'basic';
  
  // For basic plan, we'll use either validImageUrls or a calculated count
  const hasValidImageUrls = validImageUrls.length > 0;
  
  useEffect(() => {
    async function checkDiscrepancy() {
      // If basic plan user already has validImageUrls (our new tracking field),
      // we can use that directly and skip the discrepancy check
      if (isBasicPlan && hasValidImageUrls && validImageUrls.length >= 10) {
        console.log("Using existing validImageUrls:", validImageUrls.length);
        setIsLoading(false);
        return;
      }
      
      const totalImagesFromPrompts = promptsResult.reduce(
        (total, result) => total + (result.data?.prompt?.images?.length || 0),
        0
      );

      const imageCountsPerPrompt = promptsResult.map(
        (result) => result.data?.prompt?.images?.length || 0
      );

      console.log("Images received:", {
        imagesFromProps: images.length,
        validImageUrls: validImageUrls.length,
        promptResults: promptsResult.length,
        imageCountsPerPrompt,
        totalImagesFromPrompts,
        expectedByPlan: planLimit,
        isCorrect: totalImagesFromPrompts === planLimit,
        difference: planLimit - totalImagesFromPrompts,
      });

      // Check discrepancy based on total images, not prompt count
      // For basic plan, check validImageUrls first
      const hasDiscrepancy = isBasicPlan
        ? validImageUrls.length < 10 && totalImagesFromPrompts < planLimit && userData !== null
        : totalImagesFromPrompts < planLimit && userData !== null;

      console.log({
        isDiscrepancyCheck: true,
        totalImages: totalImagesFromPrompts,
        validUrls: validImageUrls.length,
        planLimit,
        shouldFix: hasDiscrepancy,
        userData: !!userData,
      });

      if (hasDiscrepancy) {
        console.log("Fixing discrepancy...");
        const updatedPrompts = await fixDiscrepancy(userData);
        console.log("Discrepancy fix result:", !!updatedPrompts);
        if (updatedPrompts) {
          setPromptsResult(updatedPrompts);
          
          // For basic plan, try to extract validImageUrls from the server response
          if (isBasicPlan && userData?.validImageUrls && userData.validImageUrls.length > 0) {
            setValidImageUrls(userData.validImageUrls);
          }
        }
      } else {
        console.log("No fix needed:", {
          reason: !userData
            ? "No user data"
            : isBasicPlan && hasValidImageUrls
            ? `Already have ${validImageUrls.length} valid tracked images`
            : "Image count meets or exceeds plan limit",
          validImageUrls: validImageUrls.length,
          totalImages: totalImagesFromPrompts,
          planLimit,
        });
        
        // Only set loading to false if we have enough images
        if ((isBasicPlan && hasValidImageUrls && validImageUrls.length >= 10) || 
            totalImagesFromPrompts >= planLimit) {
          setIsLoading(false);
        }
      }
    }
    checkDiscrepancy();
  }, [images.length, planLimit, promptsResult, userData, validImageUrls, isBasicPlan, hasValidImageUrls]);

  const displayImages = useMemo(() => {
    // For basic plan, prioritize the validImageUrls if available
    if (isBasicPlan && hasValidImageUrls) {
      return validImageUrls;
    }
    
    // For other plans or as fallback, use the promptsResult
    if (promptsResult.length > 0) {
      const sortedPrompts = [...promptsResult].sort((a, b) => {
        const dateA = new Date(
          a.data?.prompt?.created_at || a.timestamp
        ).getTime();
        const dateB = new Date(
          b.data?.prompt?.created_at || b.timestamp
        ).getTime();
        return dateB - dateA;
      });

      return sortedPrompts.flatMap((result) => result.data.prompt.images);
    }
    
    // Fallback to the images prop
    return images;
  }, [promptsResult, images, validImageUrls, isBasicPlan, hasValidImageUrls]);

  // Calculate how many skeleton loaders to show
  const uniqueImageCount = new Set(displayImages).size;
  const hasDiscrepancy = isLoading && (
    (isBasicPlan && uniqueImageCount < 10) || 
    (!isBasicPlan && uniqueImageCount < planLimit)
  );
  const skeletonCount = isBasicPlan ? 10 - uniqueImageCount : planLimit - uniqueImageCount;

  return (
    <>
      <div className="mb-4 p-4 bg-mainOrange/10 border border-mainOrange/30 text-mainBlack rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-1">Important Notice</h3>
        <p className="text-sm">
          Your generated images are available for download for the next 30 days.
          To ensure you don&apos;t lose access, please download all images to
          your device at your earliest convenience.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 h-full">
        {/* Real images that are already generated */}
        {displayImages.map((src, index) => (
          <div
            key={index}
            className="aspect-square relative overflow-hidden rounded-lg transition-transform duration-300 ease-in-out hover:scale-[1.02] hover:shadow-lg group cursor-pointer"
            onClick={() => handleDownload(index)}
          >
            <Image
              src={src}
              alt={`AI-generated image ${index + 1}`}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              className="object-cover rounded-lg opacity-80 transition-opacity duration-300 hover:opacity-100 group-hover:opacity-100 select-none pointer-events-none"
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
            />

            {/* Beta badge */}
            <div className="absolute top-2 right-2 bg-white/30 text-white text-xs font-semibold px-2 py-1 rounded-full backdrop-blur-sm shadow-sm">
              Beta V4
            </div>

            {/* Downloaded badge */}
            {downloadHistory.includes(src) && (
              <div className="absolute top-2 left-2 bg-mainGreen/80 text-mainBlack text-xs font-semibold px-2 py-1 rounded-full backdrop-blur-sm shadow-sm">
                Downloaded
              </div>
            )}

            {/* Download button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(index);
              }}
              className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-b from-transparent via-mainBlack/70 to-mainBlack text-2xl font-semibold px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:from-transparent hover:via-mainBlack/80 hover:to-mainBlack flex items-end justify-center pb-4"
            >
              Download High-Resolution
            </button>
          </div>
        ))}

        {/* Only show skeleton cards for the images that are still generating */}
        {hasDiscrepancy &&
          [...Array(skeletonCount)].map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="aspect-square relative overflow-hidden rounded-lg bg-mainBlack/5 animate-pulse"
            >
              {/* Gradient overlay to create depth */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-mainBlack/5 to-mainBlack/10" />

              {/* Beta badge placeholder */}
              <div className="absolute top-2 right-2 h-6 w-16 bg-white/30 rounded-full" />

              {/* Loading spinner and message */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-2 border-mainBlack/20 border-t-mainOrange rounded-full animate-spin mb-3" />
                <p className="text-mainBlack/70 text-sm font-medium px-4 text-center">
                  This photo is still generating, please come back in a few minutes.
                </p>
              </div>

              {/* Download button placeholder */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 h-8 w-48 bg-mainBlack/10 rounded-lg" />
            </div>
          ))}
      </div>
    </>
  );
}
