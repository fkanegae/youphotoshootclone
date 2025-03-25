import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import getUser from "@/action/getUser";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import SubmitButton from "./SubmitButton";
import submitPhotos from "@/action/submitPhotos";

// Define the interface for style items
interface StyleItem {
  backgroundTitle: string;
  backgroundPrompt: string;
  clothingTitle: string;
  clothingPrompt: string;
}

export default async function Page() {
  const userData = await getUser();
  const user = userData?.[0];

  if (!user) {
    return <div>Error: User data not found</div>;
  }

  // Only get userSelected styles now - all 10 styles are user selected
  const userSelectedStyles =
    user.styles.find((s: any) => s.type === "userSelected")?.styles || [];

  return (
    <div className="bg-mainWhite min-h-screen p-4 pt-8 md:pt-16 text-center">
      {/* 5-step progress bar */}
      <div className="max-w-[240px] mx-auto mb-5">
        <div className="flex justify-between items-center gap-2">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex-1">
              <div
                className={`h-2 rounded-full ${
                  step <= 5
                    ? "bg-gradient-to-r from-mainOrange to-mainGreen animate-gradient bg-[length:200%_200%]"
                    : "bg-gray-200"
                }`}
              ></div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-mainBlack mt-2">Step 5 of 5</p>
      </div>

      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-mainBlack mb-2">
          Order Summary
        </h1>
        <p className="text-mainBlack mb-8">
          Review your order details and upload your selfies.
        </p>

        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-mainBlack mb-4 text-left">
            Order details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <p className="text-mainBlack text-sm font-medium mb-2">
                Account Details
              </p>
              <p className="text-gray-600 text-sm">
                <span className="font-semibold">Name:</span> {user.name}
              </p>
              <p className="text-gray-600 text-sm">
                <span className="font-semibold">Email:</span> {user.email}
              </p>
              <p className="text-gray-600 text-sm">
                <span className="font-semibold">Plan:</span>{" "}
                {user.planType || "Basic"}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <p className="text-mainBlack text-sm font-medium mb-2">
                Personal Details
              </p>
              <p className="text-gray-600 text-sm">
                <span className="font-semibold">Gender:</span> {user.gender}
              </p>
              <p className="text-gray-600 text-sm">
                <span className="font-semibold">Age:</span> {user.age}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <p className="text-mainBlack text-sm font-medium mb-2">
                Payment Details
              </p>
              <p className="text-gray-600 text-sm">
                <span className="font-semibold">Status:</span>{" "}
                {user.paymentStatus || "Pending"}
              </p>
              <p className="text-gray-600 text-sm">
                <span className="font-semibold">Amount:</span>{" "}
                {user.amount ? `$${(user.amount / 100).toFixed(2)}` : "N/A"}
              </p>
              <p className="text-gray-600 text-sm">
                <span className="font-semibold">Date:</span>{" "}
                {user.paid_at
                  ? new Date(user.paid_at).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-mainBlack mb-4 text-left">
            Selected styles
          </h2>

          <p className="text-mainBlack mb-4 text-sm text-left">
            You've selected the following style combinations for your headshots:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-mainBlack text-sm font-medium mb-2 text-left">
                Your 10 selected styles
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {userSelectedStyles.map((item: StyleItem, index: number) => (
                  <li key={index} className="text-gray-600 text-sm text-left">
                    {item.backgroundTitle} - {item.clothingTitle}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mb-8 max-w-6xl mx-auto">
          <h2 className="text-xl font-semibold text-mainBlack mb-4">
            Your photos
          </h2>
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1">
            {user.userPhotos?.userSelfies.map((photo: any, index: any) => (
              <div
                key={index}
                className="w-full pt-[100%] relative bg-gray-200 rounded-md overflow-hidden"
              >
                <Suspense
                  fallback={
                    <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-md"></div>
                  }
                >
                  <Image
                    src={photo}
                    alt={`User photo ${index + 1}`}
                    fill
                    className="object-cover rounded-md"
                    loading="lazy"
                    sizes="(max-width: 640px) 20vw, (max-width: 768px) 16.67vw, (max-width: 1024px) 12.5vw, 10vw"
                    quality={80}
                  />
                </Suspense>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center space-y-4 mb-8">
          <form action={submitPhotos}>
            <SubmitButton />
          </form>

          <p className="text-xs text-gray-500 text-center max-w-xl">
            *By submitting, you agree to our terms, privacy policy, and upload
            requirements. You confirm these are your best photos and understand
            they&apos;ll influence the final result.
          </p>
        </div>
      </div>
    </div>
  );
}
