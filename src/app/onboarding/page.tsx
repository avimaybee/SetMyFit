"use client";

import { useState, useEffect, useRef } from "react";
import { currentUser, onAuthChange } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/api";
import { uploadClothingImage } from "@/lib/uploads";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { UserPreferences } from "@/types/retro";
import { toast } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  // Ref (not state): the wizard disables its own button; this only dedupes calls.
  const submittingRef = useRef(false);

  useEffect(() => {
    // Wait for Firebase to hydrate before deciding (avoids false bounce
    // to sign-in), and send already-onboarded users home.
    const unsubscribe = onAuthChange(async (fbUser) => {
      if (!fbUser) {
        router.push('/auth/sign-in');
        return;
      }
      try {
        const res = await apiFetch('/api/settings/profile');
        if (res.ok) {
          router.push('/');
          return;
        }
      } catch {
        // Profile check failed — let the user continue onboarding.
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [router]);

  const handleComplete = async (
    prefs: Partial<UserPreferences>,
    firstItem?: { file: File; base64: string }
  ) => {
    // Guard against double-submit (double-click = duplicate profile + item).
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const fbUser = await currentUser();

      if (!fbUser) {
        toast.error("Session expired. Please sign in again.");
        router.push('/auth/sign-in');
        return;
      }

      // 1. Save profile preferences
      const response = await apiFetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });

      if (response.status === 401) {
        toast.error("Session expired. Please sign in again.");
        router.push('/auth/sign-in');
        return;
      }
      if (!response.ok) throw new Error("Failed to save preferences");

      // 2. If first item was uploaded, save it to wardrobe
      let itemSaved = true;
      if (firstItem) {
        const saveToastId = toast.loading("Saving your first item...");

        try {
          // 2a. Analyze image with AI (optional - for auto-fill)
          let analysisResult = null;
          try {
            const analyzeRes = await apiFetch("/api/wardrobe/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                // Full data URL — the route extracts bytes + real mime type
                // (resized WebP from the onboarding form).
                image: firstItem.base64,
                mimeType: firstItem.file.type
              }),
            });

            if (analyzeRes.ok) {
              const analyzeData = await analyzeRes.json();
              if (analyzeData.success) {
                analysisResult = analyzeData.data;
                if (analyzeData.partial) {
                  toast("AI analysis is unavailable — using defaults you can edit later.");
                }
              }
            }
          } catch (analyzeError) {
            console.warn("AI analysis failed, using defaults:", analyzeError);
          }

          // 2b. Upload image to storage (with progress)
          const uploadResult = await uploadClothingImage(firstItem.file, fbUser.uid, {
            onProgress: (percent) => {
              toast.loading(`Saving your first item... ${percent}%`, { id: saveToastId });
            },
          });

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

          const createRes = await apiFetch("/api/wardrobe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(itemPayload),
          });

          if (createRes.status === 401) {
            toast.error("Session expired. Please sign in again.", { id: saveToastId });
            router.push('/auth/sign-in');
            return;
          }
          if (!createRes.ok) {
            const errorData = await createRes.json();
            throw new Error(errorData.error || "Failed to create wardrobe item");
          }

          toast.success("First item added to your wardrobe! 🎉", { id: saveToastId });
        } catch (itemError) {
          itemSaved = false;
          console.error("Error saving first item:", itemError);
          toast.error("Item upload failed, but your profile was saved. Add items from the wardrobe page.", { id: saveToastId });
        }
      }

      if (itemSaved) {
        toast.success("Setup complete! Welcome to the system.");
      } else {
        toast("Setup saved — wardrobe upload skipped. Add items anytime.");
      }
      router.push("/");
    } catch (err) {
      console.error("Error saving preferences:", err);
      toast.error("Failed to save setup.");
    } finally {
      submittingRef.current = false;
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
