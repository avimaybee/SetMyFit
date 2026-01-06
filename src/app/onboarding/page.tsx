"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadClothingImage } from "@/lib/supabase/storage";
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

  const handleComplete = async (
    prefs: Partial<UserPreferences>,
    firstItem?: { file: File; base64: string }
  ) => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Session expired. Please sign in again.");
        router.push('/auth/sign-in');
        return;
      }

      // 1. Save profile preferences
      const response = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });

      if (!response.ok) throw new Error("Failed to save preferences");

      // 2. If first item was uploaded, save it to wardrobe
      if (firstItem) {
        const saveToastId = toast.loading("Saving your first item...");

        try {
          // 2a. Analyze image with AI (optional - for auto-fill)
          let analysisResult = null;
          try {
            const analyzeRes = await fetch("/api/wardrobe/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image: firstItem.base64.split(',')[1], // Remove data:image/xxx;base64, prefix
                mimeType: firstItem.file.type
              }),
            });

            if (analyzeRes.ok) {
              const analyzeData = await analyzeRes.json();
              if (analyzeData.success) {
                analysisResult = analyzeData.data;
              }
            }
          } catch (analyzeError) {
            console.warn("AI analysis failed, using defaults:", analyzeError);
          }

          // 2b. Upload image to storage
          const uploadResult = await uploadClothingImage(firstItem.file, session.user.id);

          if (!uploadResult.success || !uploadResult.url) {
            throw new Error(uploadResult.error || "Failed to upload image");
          }

          // 2c. Create wardrobe item with analyzed data or defaults
          const itemPayload = {
            name: analysisResult?.name || "My First Item",
            type: analysisResult?.type || analysisResult?.category || "Top",
            category: "General",
            material: analysisResult?.material || "Cotton",
            color: analysisResult?.color || "Unknown",
            season_tags: analysisResult?.season_tags || ["all_season"],
            dress_code: analysisResult?.dress_code || ["Casual"],
            image_url: uploadResult.url,
            insulation_value: analysisResult?.insulation_value || 5,
            style_tags: analysisResult?.style_tags || [],
          };

          const createRes = await fetch("/api/wardrobe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(itemPayload),
          });

          if (!createRes.ok) {
            const errorData = await createRes.json();
            throw new Error(errorData.error || "Failed to create wardrobe item");
          }

          toast.success("First item added to your wardrobe! 🎉", { id: saveToastId });
        } catch (itemError) {
          console.error("Error saving first item:", itemError);
          toast.error("Item upload failed, but your profile was saved. Add items from the wardrobe page.", { id: saveToastId });
        }
      }

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
