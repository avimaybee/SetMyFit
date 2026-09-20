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
          const json = await res.json().catch(() => null);
          if (json && json.data !== null && json.hasProfile !== false) {
            router.push('/');
            return;
          }
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
        toast.error("Your session timed out. Log back in real quick.");
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
        toast.error("Your session timed out. Log back in real quick.");
        router.push('/auth/sign-in');
        return;
      }
      if (!response.ok) throw new Error("Failed to save preferences");

      // 2. If first item was uploaded, save it to wardrobe
      let itemSaved = true;
      if (firstItem) {
        const saveToastId = toast.loading("Adding your first piece...");

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
                  toast("Auto-tagging was unavailable — using default tags you can edit later.");
                }
              }
            }
          } catch (analyzeError) {
            console.warn("AI analysis failed, using defaults:", analyzeError);
          }

          // 2b. Upload image to storage (with progress)
          const uploadResult = await uploadClothingImage(firstItem.file, fbUser.uid, {
            onProgress: (percent) => {
              toast.loading(`Adding your first piece... ${percent}%`, { id: saveToastId });
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
            toast.error("Your session timed out. Log back in real quick.", { id: saveToastId });
            router.push('/auth/sign-in');
            return;
          }
          if (!createRes.ok) {
            const errorData = await createRes.json();
            throw new Error(errorData.error || "Failed to create wardrobe item");
          }

          toast.success("First piece added to your rack.", { id: saveToastId });
        } catch (itemError) {
          itemSaved = false;
          console.error("Error saving first item:", itemError);
          toast.error("Couldn't upload that photo, but your style profile is saved. You can add pieces anytime.", { id: saveToastId });
        }
      }

      if (itemSaved) {
        toast.success("All set. Your stylist is ready.");
      } else {
        toast("Style profile saved. Add clothes to your closet whenever you're ready.");
      }
      router.push("/");
    } catch (err) {
      console.error("Error saving preferences:", err);
      toast.error("Couldn't save your preferences. Try once more.");
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
