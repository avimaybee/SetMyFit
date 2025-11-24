"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { UserPreferences } from "@/types/retro";
import { toast } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/sign-in');
      } else {
        setLoading(false);
      }
    };
    checkSession();
  }, [router]);

  const handleComplete = async (prefs: Partial<UserPreferences>) => {
    try {
      const response = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });

      if (!response.ok) throw new Error("Failed to save preferences");

      toast.success("Setup complete! Welcome to the system.");
      router.push("/");
    } catch (err) {
      console.error("Error saving preferences:", err);
      toast.error("Failed to save setup.");
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#e0e0e0] flex items-center justify-center font-mono">LOADING...</div>;
  }

  return (
    <div className="min-h-screen bg-[#e0e0e0] p-4 font-mono">
      <OnboardingFlow onComplete={handleComplete} />
    </div>
  );
}
