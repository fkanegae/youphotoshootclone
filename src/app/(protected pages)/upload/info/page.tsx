"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateUser } from "@/action/updateUser";
import { createClient } from "@/utils/supabase/client";

const isDevelopment = process.env.NODE_ENV === 'development';

interface FormData {
  name: string;
  age: string;
  gender: string;
}

export default function Page() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    age: "",
    gender: "",
  });

  useEffect(() => {
    const checkAuth = async () => {
      if (isDevelopment) {
        return;
      }

      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await updateUser(formData);
      // The updateUser action will handle the redirect
    } catch (error) {
      setError("Failed to update user information. Please try again.");
      console.error("Error updating user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-mainWhite p-4">
        <div className="max-w-md mx-auto mt-8 p-4 bg-red-50 rounded-lg">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] p-4 md:p-8">
      <div className="max-w-[240px] mx-auto mb-5">
        <div className="flex justify-between items-center gap-2">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex-1">
              <div
                className={`h-2 rounded-full ${
                  step <= 2
                    ? "bg-gradient-to-r from-mainOrange to-mainGreen animate-gradient bg-[length:200%_200%]"
                    : "bg-gray-200"
                }`}
              ></div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-mainBlack mt-2">Step 2 of 5</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto">
        <h1 className="text-[40px] font-bold text-mainBlack mb-4">
          Basic Information
        </h1>
        <p className="text-lg text-mainBlack mb-8">
          Please provide your basic details to personalize your experience.
        </p>

        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-lg font-medium text-mainBlack mb-2">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mainOrange focus:ring-mainOrange text-base py-2 px-3 text-gray-900 placeholder-gray-400"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label htmlFor="age" className="block text-lg font-medium text-mainBlack mb-2">
              Age Range
            </label>
            <select
              id="age"
              name="age"
              value={formData.age}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mainOrange focus:ring-mainOrange text-base py-2 px-3 text-gray-900"
            >
              <option value="" className="text-gray-400">Select age range</option>
              <option value="18-25 years">18-25 years</option>
              <option value="26-29 years">26-29 years</option>
              <option value="30-35 years">30-35 years</option>
              <option value="36-40 years">36-40 years</option>
              <option value="41-45 years">41-45 years</option>
              <option value="46-50 years">46-50 years</option>
              <option value="51+ years">51+ years</option>
            </select>
          </div>

          <div>
            <label htmlFor="gender" className="block text-lg font-medium text-mainBlack mb-2">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mainOrange focus:ring-mainOrange text-base py-2 px-3 text-gray-900"
            >
              <option value="" className="text-gray-400">Select gender</option>
              <option value="man">Man</option>
              <option value="woman">Woman</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-mainOrange to-mainGreen text-white font-semibold py-3 px-4 rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mainOrange mt-8 transition-all duration-200"
          >
            {isLoading ? "Saving..." : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
