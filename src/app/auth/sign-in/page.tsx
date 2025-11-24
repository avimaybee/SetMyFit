"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LoginPage } from "@/components/auth/LoginPage";
import { toast } from "@/components/ui/toaster";

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
      const supabase = createClient();

      if (isSignUp) {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          toast.success("Account created! Welcome to setmyfit! 🎉");
          window.location.href = "/onboarding";
        }
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          toast.success("Welcome back!");
          window.location.href = "/";
        }
      }
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
