"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { clearSession, currentUser, signOut } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/api";
import { SettingsPage as SettingsPageComponent } from "@/components/settings/SettingsPage";
import { UserPreferences } from "@/types/retro";
import { toast } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<UserPreferences>({});
  // Ref mirror so rapid consecutive updates merge instead of clobbering.
  const prefsRef = useRef<UserPreferences>({});
  const [loading, setLoading] = useState(true);
  const loggingOutRef = useRef(false);
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
      const fbUser = await currentUser();

      if (!fbUser) {
          router.push('/auth/sign-in');
          return;
      }

      const response = await apiFetch("/api/settings/profile");
      if (response.status === 401) {
        router.push('/auth/sign-in');
        return;
      }
      if (response.status === 404) {
        // No profile yet â€” new user, send to onboarding.
        router.push('/onboarding');
        return;
      }
      if (!response.ok) throw new Error("Failed to fetch settings");

      const data = await response.json();
      if (data.success && data.data && data.data.preferences) {
        const prefs = data.data.preferences;
        const mapped: UserPreferences = {
            preferred_styles: prefs.preferred_styles || [],
            colors: prefs.preferred_colors || [],
            temperature_sensitivity: prefs.temperature_sensitivity || 0,
            variety_days: prefs.variety_days || 7,
            repeat_interval: prefs.repeat_interval || 0,
            style_strictness: prefs.style_strictness || 50,
            theme: prefs.theme || 'RETRO',
            gender: prefs.gender || 'NEUTRAL'
        };
        prefsRef.current = mapped;
        setPreferences(mapped);
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      toast.error("Couldn't load your preferences right now. Give it a refresh.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleUpdate = async (newPrefs: Partial<UserPreferences>) => {
      try {
          // Merge against the ref (not stale state) so rapid updates compose.
          const updatedPrefs = { ...prefsRef.current, ...newPrefs };
          prefsRef.current = updatedPrefs;
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

          const response = await apiFetch("/api/settings/profile", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
          });

          if (!response.ok) throw new Error("Failed to update settings");

          toast.success("Preferences saved.");
      } catch (err) {
          console.error("Error updating settings:", err);
          toast.error("Couldn't save that change. Try again.");
          fetchSettings(); // Revert on error
      }
  };

  const handleLogout = async () => {
      if (loggingOutRef.current) return;
      if (!window.confirm("Log out of SETMYFIT?")) return;
      loggingOutRef.current = true;
      try {
        await signOut().catch(() => undefined);
        await clearSession();
      } finally {
        // Never leak one user's cached recommendations/locks to the next.
        try {
          sessionStorage.clear();
        } catch {
          // Storage unavailable â€” non-fatal.
        }
        router.push('/auth/sign-in');
      }
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-full bg-[var(--bg-main)]">
              <div className="font-mono text-xl animate-pulse text-[var(--text)]">LOADING SETTINGS...</div>
          </div>
      );
  }

  return (
    <div className="h-full p-4 md:p-8 overflow-y-auto bg-[var(--bg-main)] min-h-screen text-[var(--text)]">
        <h1 className="sr-only">Settings</h1>
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
