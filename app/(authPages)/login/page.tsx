export default async function Login({ searchParams }: LoginProps) {
  // Check if user is logged in
  const userData: any = await getUser();
  // Add null check before accessing array index
  if (userData && userData.length > 0) {
    const user = userData[0];
    return handleRedirectBasedOnWorkStatus(user);
  }

  // In the signIn function, add the same null check:
  const signIn = async (formData: FormData): Promise<never> => {
    "use server";
    // ... existing auth code ...

    } else {
      // Fetch user data after successful sign-in using getUser function
      const userData: any = await getUser();
      // Add null check here too
      if (userData && userData.length > 0) {
        const user = userData[0];
        return handleRedirectBasedOnWorkStatus(user);
      }
      // If we can't get user data, redirect to forms as a fallback
      return redirect("/forms");
    }
  };

  // ... rest of the code ...
} 