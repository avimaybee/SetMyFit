"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { SettingsPage as SettingsPageComponent } from "@/components/settings/SettingsPage";
import { UserPreferences } from "@/types/retro";
import { toast } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Effect for Hacker Mode
  useEffect(() => {
    if (preferences.theme === 'HACKER') {
      document.body.classList.add('theme-hacker');
    } else {
      document.body.classList.remove('theme-hacker');
    }
  }, [preferences.theme]);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
          router.push('/auth/sign-in');
          return;
      }

      const response = await fetch("/api/settings/profile");
      if (!response.ok) throw new Error("Failed to fetch settings");

      const data = await response.json();
      if (data.success && data.data && data.data.preferences) {
        const prefs = data.data.preferences;
        setPreferences({
            preferred_styles: prefs.preferred_styles || [],
            colors: prefs.preferred_colors || [],
            temperature_sensitivity: prefs.temperature_sensitivity || 0,
            variety_days: prefs.variety_days || 7,
            repeat_interval: prefs.repeat_interval || 0,
            style_strictness: prefs.style_strictness || 50,
            theme: prefs.theme || 'RETRO',
            gender: prefs.gender || 'NEUTRAL'
        });
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      toast.error("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleUpdate = async (newPrefs: Partial<UserPreferences>) => {
      try {
          // Optimistic update
          const updatedPrefs = { ...preferences, ...newPrefs };
          setPreferences(updatedPrefs);

          const payload = {
              preferences: {
                  preferred_styles: updatedPrefs.preferred_styles,
                  preferred_colors: updatedPrefs.colors,
                  temperature_sensitivity: updatedPrefs.temperature_sensitivity,
                  variety_days: updatedPrefs.variety_days,
                  repeat_interval: updatedPrefs.repeat_interval,
                  style_strictness: updatedPrefs.style_strictness,
                  theme: updatedPrefs.theme,
                  gender: updatedPrefs.gender
              }
          };

          const response = await fetch("/api/settings/profile", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
          });

          if (!response.ok) throw new Error("Failed to update settings");

          toast.success("Settings updated.");
      } catch (err) {
          console.error("Error updating settings:", err);
          toast.error("Failed to update settings.");
          fetchSettings(); // Revert on error
      }
  };

  const handleLogout = async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/auth/sign-in');
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-full bg-[var(--bg-primary)]">
              <div className="font-mono text-xl animate-pulse text-[var(--text)]">LOADING SETTINGS...</div>
          </div>
      );
  }

  return (
    <div className="h-full p-4 md:p-8 overflow-y-auto bg-[var(--bg-primary)] min-h-screen text-[var(--text)]">
        <div className="max-w-7xl mx-auto">
            <SettingsPageComponent 
                preferences={preferences} 
                onUpdate={handleUpdate} 
                onLogout={handleLogout}
            />
        </div>
    </div>
  );
}
