// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import ClothingStyleModal from "./ClothingStyleModal";
import styleData from "./styleData.json";
import { updateStyles } from "@/action/updateStyles";
import getUser from "@/action/getUser";

const isDevelopment = process.env.NODE_ENV === 'development';

interface BackgroundStyle {
  backgroundTitle: string;
  backgroundPrompt: string;
  menImage: string;
  womenImage: string;
}

interface ClothingStyle {
  clothingTitle: string;
  clothingPrompt: string;
  gender: string[];
}

type StyleObject = BackgroundStyle | ClothingStyle;

/**
 * Page component for style selection in the headshot upload process.
 * Allows users to select all 10 styles for their headshots.
 */
export default function Page() {
  // State for storing user data
  const [userData, setUserData] = useState<any>(null);
  // Update the state type
  const [selectedStyles, setSelectedStyles] = useState<StyleObject[]>([]);
  // State for controlling the visibility of the clothing style modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  // State for storing the currently selected background style
  const [currentBackgroundStyle, setCurrentBackgroundStyle] =
    useState<StyleObject | null>(null);
  // State for tracking processing status
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (isDevelopment) {
        // Use mock data in development
        setUserData({
          gender: "woman", // or "man" - change this to test different genders
          // Add other mock data as needed
        });
        return;
      }

      const data = await getUser();
      setUserData(data?.[0]);
    };
    fetchUserData();
  }, []);

  // Filter clothing styles based on user's gender
  const filteredClothingStyles = styleData.clothingStyles.filter(
    (style) => !userData?.gender || style.gender.includes(userData.gender)
  );

  // Add this new function to check if a style is already selected
  const isStyleSelected = (backgroundStyle: StyleObject) => {
    return selectedStyles.some((style) =>
      style.backgroundTitle.startsWith(backgroundStyle.backgroundTitle)
    );
  };

  const handleCardClick = (style: StyleObject) => {
    if (!isStyleSelected(style)) {
      setCurrentBackgroundStyle(style);
      setIsModalOpen(true);
    }
  };

  const handleSelectClick = (
    backgroundStyle: StyleObject,
    clothingStyle: StyleObject
  ) => {
    if (selectedStyles.length < 10) {
      const newSelectedStyles = [
        ...selectedStyles,
        {
          background: backgroundStyle.backgroundTitle,
          clothing: clothingStyle.clothingTitle,
          // Store these too for reference, but they're not used in the database schema
          backgroundTitle: backgroundStyle.backgroundTitle,
          backgroundPrompt: backgroundStyle.backgroundPrompt,
          clothingTitle: clothingStyle.clothingTitle,
          clothingPrompt: clothingStyle.clothingPrompt,
        },
      ];
      setSelectedStyles(newSelectedStyles);
    }
    setIsModalOpen(false);
  };

  /**
   * Handles the deletion of a selected style.
   * Removes the style at the specified index from the selected styles list.
   * @param indexToDelete - The index of the style to be deleted
   */
  const handleDeleteStyle = (indexToDelete: number) => {
    const updatedStyles = selectedStyles.filter(
      (_, index) => index !== indexToDelete
    );
    setSelectedStyles(updatedStyles);
  };

  /**
   * Randomly selects styles to fill up the remaining slots in the Selected styles list.
   */
  const handleChooseForMe = () => {
    const remainingSlots = 10 - selectedStyles.length;
    const newStyles: StyleObject[] = [];

    for (let i = 0; i < remainingSlots; i++) {
      const randomBackgroundStyle =
        styleData.backgroundStyles[
          Math.floor(Math.random() * styleData.backgroundStyles.length)
        ];
      const randomClothingStyle =
        filteredClothingStyles[
          Math.floor(Math.random() * filteredClothingStyles.length)
        ];
      newStyles.push({
        background: randomBackgroundStyle.backgroundTitle,
        clothing: randomClothingStyle.clothingTitle,
        // Store these too for reference, but they're not used in the database schema
        backgroundTitle: randomBackgroundStyle.backgroundTitle,
        backgroundPrompt: randomBackgroundStyle.backgroundPrompt,
        clothingTitle: randomClothingStyle.clothingTitle,
        clothingPrompt: randomClothingStyle.clothingPrompt,
      });
    }

    setSelectedStyles([...selectedStyles, ...newStyles]);
  };

  // Update handleContinue to use the new structure with empty preselected styles
  const handleContinue = async () => {
    if (selectedStyles.length === 10 && !isProcessing) {
      setIsProcessing(true);
      try {
        await updateStyles({
          userSelected: selectedStyles,
          preSelected: [] // No more preselected styles
        });
        // The redirect is handled in the server action
      } catch (error) {
        console.error("Error updating styles:", error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="bg-mainWhite min-h-screen p-4 pt-8 md:pt-16">
      {/* 5-step progress bar */}
      <div className="max-w-[240px] mx-auto mb-5">
        <div className="flex justify-between items-center gap-2">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex-1">
              <div
                className={`h-2 rounded-full ${
                  step <= 4
                    ? "bg-gradient-to-r from-mainOrange to-mainGreen animate-gradient bg-[length:200%_200%]"
                    : "bg-gray-200"
                }`}
              ></div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-mainBlack mt-2 text-center">
          Step 4 of 5
        </p>
      </div>

      <div className="container mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-mainBlack mb-4 text-center">
          Select 10 styles for your headshots
        </h1>
        <p className="text-lg text-mainBlack mb-8 text-center">
          Choose which background and clothing styles you want to wear for your
          headshots or let us choose for you.
        </p>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-2/3">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-mainBlack">
                Portrait styles {userData?.gender === "woman" ? "for women" : "for men"}
              </h2>
              <button
                className={`font-medium px-4 py-2 rounded transition-colors ${
                  selectedStyles.length === 10
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-gray-200 text-mainBlack hover:bg-gray-300"
                }`}
                onClick={handleChooseForMe}
                disabled={selectedStyles.length === 10}
              >
                {selectedStyles.length === 10 ? (
                  "Selection complete ✓"
                ) : (
                  <>Choose for me {selectedStyles.length}/10</>
                )}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {styleData.backgroundStyles
                .filter((style) => {
                  // Check if the style is valid for the user's gender
                  return (
                    !userData?.gender ||
                    (userData.gender === "woman" && style.womenImage) ||
                    (userData.gender === "man" && style.menImage)
                  );
                })
                .map((style, index) => {
                const isSelected = isStyleSelected(style);
                return (
                  <div
                    key={index}
                    className={`aspect-square relative rounded-lg overflow-hidden cursor-pointer border-2 ${
                      isSelected
                        ? "border-mainGreen shadow-md"
                        : "border-transparent"
                    }`}
                    onClick={() => handleCardClick(style)}
                  >
                    {/* Display different images based on gender */}
                    <Image
                      src={
                        userData?.gender === "woman"
                          ? style.womenImage
                          : style.menImage
                      }
                      alt={style.backgroundTitle}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      className="object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                      <h3 className="text-white font-medium">{style.backgroundTitle}</h3>
                    </div>
                    <button
                      className={`absolute inset-0 w-full h-full flex items-center justify-center ${
                        isSelected ? "opacity-100" : "opacity-0 hover:opacity-100"
                      } transition-opacity duration-300`}
                    >
                      <span
                        className={`px-4 py-2 rounded-lg ${
                          isSelected
                            ? "bg-mainGreen text-white"
                            : "bg-mainOrange text-white"
                        }`}
                      >
                        {isSelected ? "Selected ✓" : "Select +"}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:w-1/3">
            <h2 className="text-xl font-semibold text-mainBlack mb-4">
              Selected styles
            </h2>
            <div className="bg-gray-100 rounded-lg shadow-md p-4 mb-4">
              <p className="text-mainBlack mb-2 font-medium">
                Selected styles {selectedStyles.length}/10
              </p>
              {selectedStyles.map((style, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg p-3 mb-2 text-mainBlack relative shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col pr-8">
                    <span className="font-semibold">
                      {style.backgroundTitle}
                    </span>
                    <span className="text-sm text-gray-500">
                      {style.clothingTitle}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteStyle(index)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition-colors"
                    aria-label="Delete style"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}

              {[...Array(10 - selectedStyles.length)].map((_, index) => (
                <div
                  key={index}
                  className="bg-gray-200 rounded-lg p-3 mb-2 text-gray-500 italic"
                >
                  Style not yet selected
                </div>
              ))}
            </div>

            <button
              className={`w-full mt-4 font-medium px-4 py-2 rounded transition-colors ${
                selectedStyles.length === 10 && !isProcessing
                  ? "bg-mainOrange text-mainBlack hover:bg-opacity-90"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              disabled={selectedStyles.length < 10 || isProcessing}
              onClick={handleContinue}
            >
              {isProcessing
                ? "Processing..."
                : selectedStyles.length === 10
                ? "Continue to next step →"
                : `Select ${10 - selectedStyles.length} more style${
                    selectedStyles.length === 9 ? "" : "s"
                  }`}
            </button>
          </div>
        </div>
      </div>

      <ClothingStyleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={(clothingStyle) =>
          handleSelectClick(currentBackgroundStyle!, clothingStyle)
        }
        clothingStyles={filteredClothingStyles}
      />
    </div>
  );
}
