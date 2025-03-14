import Header from "@/components/Header";
import getUser from "@/action/getUser";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const metadata = {
  title: "Your Dashboard | AI Headshot Generator",
  description:
    "Manage your AI-generated headshots, account settings, and subscription plan.",
};

const isDevelopment = process.env.NODE_ENV === 'development';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Skip auth check in development mode
  if (isDevelopment) {
    return (
      <main className="min-h-screen bg-mainWhite">
        <Header userAuth={true} />
        {children}
      </main>
    );
  }

  const supabase = createClient();

  try {
    // First check if we have a valid auth session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error in layout:", authError);
      redirect('/login');
    }

    // Then get the user data
    const userData = await getUser();
    
    if (!userData || !userData[0]) {
      console.error("No user data found in layout");
      redirect('/login');
    }

    return (
      <main className="min-h-screen bg-mainWhite">
        <Header userAuth={true} />
        {children}
      </main>
    );
  } catch (error) {
    console.error("Error in layout:", error);
    redirect('/login');
  }
}
