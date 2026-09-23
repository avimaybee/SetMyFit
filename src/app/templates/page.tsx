"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { currentUser } from "@/lib/firebase/client";
import { TemplatesPage as TemplatesPageComponent } from "@/components/templates/TemplatesPage";
import { OutfitTemplate, ClothingItem } from "@/types/retro";
import { toast } from "@/components/ui/toaster";

// Template -> generator occasion mapping (MissionControl profiles).
const TEMPLATE_OCCASIONS: Record<string, string> = {
  t1: 'Work',
  t2: 'Casual',
  t3: 'Date',
  t4: 'Travel',
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<(OutfitTemplate & { requirements?: string[] })[]>([]);
  const [wardrobeItems, setWardrobeItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const router = useRouter();

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      
      const [templateRes, wardrobeRes] = await Promise.allSettled([
        apiFetch("/api/templates"),
        apiFetch("/api/wardrobe")
      ]);

      if (wardrobeRes.status === 'fulfilled' && wardrobeRes.value.ok) {
        try {
          const wJson = await wardrobeRes.value.json();
          if (wJson.success && Array.isArray(wJson.data)) {
            setWardrobeItems(wJson.data);
          }
        } catch {
          // Wardrobe matching optional
        }
      }

      if (templateRes.status === 'fulfilled' && templateRes.value.ok) {
        const result = await templateRes.value.json();
        if (result.success) {
          const raw = result.data as Array<Record<string, unknown>>;
          const mappedTemplates = raw.map((t) => ({
            id: String(t['id'] ?? ''),
            name: String(t['name'] ?? ''),
            description: String(t['description'] ?? ''),
            styleTags: (t['style_tags'] as string[]) || [],
            coverImage: String(t['cover_image'] ?? ''),
            requirements: (t['requirements'] as string[]) || []
          }));
          setTemplates(mappedTemplates);
        } else {
          console.error("Failed to fetch templates:", result.error);
          toast.error("Couldn't pull up style presets. Try refreshing.");
          setLoadFailed(true);
        }
      } else {
        throw new Error("Failed to fetch templates");
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Couldn't pull up style presets. Try refreshing.");
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleApply = async (template: OutfitTemplate) => {
    // Light integration: loading a blueprint sets the generator's mission
    // profile, then drops the user on Home to generate.
    const occasion = TEMPLATE_OCCASIONS[template.id] ?? '';
    try {
      const fbUser = await currentUser();
      if (fbUser) {
        sessionStorage.setItem(
          `setmyfit:${fbUser.uid}:pendingTemplate`,
          JSON.stringify({ occasion, templateId: template.id, templateName: template.name })
        );
      }
    } catch {
      // Storage unavailable — still navigate; occasion just won't prefill.
    }
    toast.success(`Loaded ${template.name} for ${occasion || 'your next fit'}.`);
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--bg-main)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--border)]"></div>
      </div>
    );
  }

  if (loadFailed && templates.length === 0) {
    return (
      <div className="h-full p-4 md:p-8 overflow-y-auto bg-[var(--bg-main)] min-h-screen text-[var(--text)]">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white border-2 border-black p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="font-mono font-bold">COULDN&apos;T LOAD STYLE TEMPLATES</p>
            <p className="font-mono text-xs mt-2 text-gray-600">Check your connection and try again.</p>
            <button
              onClick={fetchTemplates}
              className="mt-4 bg-black text-white font-mono text-xs px-4 py-2 border-2 border-black hover:bg-gray-800"
            >
              RETRY
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-6 text-[var(--text)]">
      <h1 className="sr-only">Outfit templates</h1>
      <TemplatesPageComponent templates={templates} onApply={handleApply} userItems={wardrobeItems} />
    </div>
  );
}
