"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateUser } from "@/action/updateUser";
import { createClient } from "@/utils/supabase/client";

const isDevelopment = process.env.NODE_ENV === 'development';

interface FormData {
  name: string;
  age: string;
  ethnicity: string;
  height: string;
  bodyType: string;
  eyeColor: string;
  gender: string;
}

export default function Page() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    age: "",
    ethnicity: "",
    height: "",
    bodyType: "",
    eyeColor: "",
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
          Tell us about yourself
        </h1>
        <p className="text-lg text-mainBlack mb-8">
          This helps us generate photos that match your appearance.
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mainOrange focus:ring-mainOrange text-base py-2 px-3"
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mainOrange focus:ring-mainOrange text-base py-2 px-3"
            >
              <option value="">Select age range</option>
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
            <label htmlFor="ethnicity" className="block text-lg font-medium text-mainBlack mb-2">
              Ethnicity
            </label>
            <select
              id="ethnicity"
              name="ethnicity"
              value={formData.ethnicity}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mainOrange focus:ring-mainOrange text-base py-2 px-3"
            >
              <option value="">Select ethnicity</option>
              <option value="Asian">Asian</option>
              <option value="Black">Black</option>
              <option value="Hispanic">Hispanic</option>
              <option value="Middle Eastern">Middle Eastern</option>
              <option value="White">White</option>
              <option value="Mixed">Mixed</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="height" className="block text-lg font-medium text-mainBlack mb-2">
              Height Range
            </label>
            <select
              id="height"
              name="height"
              value={formData.height}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mainOrange focus:ring-mainOrange text-base py-2 px-3"
            >
              <option value="">Select height range</option>
              <option value="Less than 150 cm (Less than 4&apos;11&quot;)">Less than 150 cm (Less than 4&apos;11&quot;)</option>
              <option value="151 - 160 cm (4&apos;11&quot; - 5&apos;3&quot;)">151 - 160 cm (4&apos;11&quot; - 5&apos;3&quot;)</option>
              <option value="161 - 170 cm (5&apos;3&quot; - 5&apos;7&quot;)">161 - 170 cm (5&apos;3&quot; - 5&apos;7&quot;)</option>
              <option value="171 - 180 cm (5&apos;7&quot; - 5&apos;11&quot;)">171 - 180 cm (5&apos;7&quot; - 5&apos;11&quot;)</option>
              <option value="181 - 190 cm (5&apos;11&quot; - 6&apos;3&quot;)">181 - 190 cm (5&apos;11&quot; - 6&apos;3&quot;)</option>
              <option value="More than 190 cm (More than 6&apos;3&quot;)">More than 190 cm (More than 6&apos;3&quot;)</option>
            </select>
          </div>

          <div>
            <label htmlFor="bodyType" className="block text-lg font-medium text-mainBlack mb-2">
              Body Type
            </label>
            <select
              id="bodyType"
              name="bodyType"
              value={formData.bodyType}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mainOrange focus:ring-mainOrange text-base py-2 px-3"
            >
              <option value="">Select body type</option>
              <option value="Ectomorph (Lean)">Ectomorph (Lean)</option>
              <option value="Mesomorph (Athletic)">Mesomorph (Athletic)</option>
              <option value="Endomorph (Full)">Endomorph (Full)</option>
            </select>
          </div>

          <div>
            <label htmlFor="eyeColor" className="block text-lg font-medium text-mainBlack mb-2">
              Eye Color
            </label>
            <select
              id="eyeColor"
              name="eyeColor"
              value={formData.eyeColor}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mainOrange focus:ring-mainOrange text-base py-2 px-3"
            >
              <option value="">Select eye color</option>
              <option value="Brown">Brown</option>
              <option value="Blue">Blue</option>
              <option value="Green">Green</option>
              <option value="Hazel">Hazel</option>
              <option value="Gray">Gray</option>
              <option value="Other">Other</option>
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mainOrange focus:ring-mainOrange text-base py-2 px-3"
            >
              <option value="">Select gender</option>
              <option value="man">Man</option>
              <option value="woman">Woman</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-mainYellow text-mainBlack font-semibold py-3 px-4 rounded-md hover:bg-mainYellow/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mainYellow mt-8"
          >
            {isLoading ? "Saving..." : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
