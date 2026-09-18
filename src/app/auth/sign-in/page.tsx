"use client";

import { useState } from "react";
import { persistSession, signIn, signUp } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/api";
import { LoginPage } from "@/components/auth/LoginPage";
import { toast } from "@/components/ui/toaster";

// NOTE: Firebase-config gating lives in MainLayout (useFirebaseConfig),
// which wraps this page — no local check needed here. signIn/signUp throw
// a clear error if config is somehow still missing.
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const cleanEmail = email.trim();
      const user = isSignUp
        ? await signUp(cleanEmail, password)
        : await signIn(cleanEmail, password);

      if (!user) {
        throw new Error("Authentication failed");
      }

      // Persist session cookie for middleware; without it the next
      // navigation bounces back to sign-in.
      const sessionResult = await persistSession();
      if (!sessionResult.ok) {
        throw new Error(sessionResult.error || "Could not create a session. Please try again.");
      }

      if (isSignUp) {
        toast.success("Account created! Welcome to setmyfit! 🎉");
        window.location.href = "/onboarding";
        return;
      }

      // Returning users land based on profile: no profile = onboarding.
      try {
        const res = await apiFetch("/api/settings/profile");
        if (res.status === 404) {
          toast.success("Welcome! Let's set up your profile.");
          window.location.href = "/onboarding";
          return;
        }
      } catch {
        // Profile check failed — home will surface errors if any.
      }
      toast.success("Welcome back!");
      window.location.href = "/";
    } catch (err) {
      console.error("Auth error:", err);
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginPage
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        isSignUp={isSignUp}
        setIsSignUp={setIsSignUp}
        loading={loading}
        error={error}
        onSubmit={handleAuth}
    />
  );
}
