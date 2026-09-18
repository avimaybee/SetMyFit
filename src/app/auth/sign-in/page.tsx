"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import {
  persistSession,
  signIn,
  signUp,
  signInWithGoogle,
  signInAsGuest,
  createRecaptchaVerifier,
  sendPhoneOtp,
  verifyPhoneOtp,
  type RecaptchaVerifier,
} from "@/lib/firebase/client";
import { apiFetch } from "@/lib/api";
import { LoginPage } from "@/components/auth/LoginPage";
import { toast } from "@/components/ui/toaster";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phone authentication states
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  const handlePostLogin = async (user: User, isNewUser = false) => {
    // Persist session cookie for middleware; without it navigation bounces back
    const sessionResult = await persistSession();
    if (!sessionResult.ok) {
      throw new Error(sessionResult.error || "Could not create a session. Please try again.");
    }

    if (isNewUser) {
      toast.success("Account initialized! Welcome to SetMyFit! 🎉");
      window.location.href = "/onboarding";
      return;
    }

    // Returning users land based on profile: no profile = onboarding
    try {
      const res = await apiFetch("/api/settings/profile");
      if (res.status === 404) {
        toast.success("Welcome! Let's configure your style.");
        window.location.href = "/onboarding";
        return;
      }
    } catch {
      // Profile check failed — home page will handle gracefully
    }

    toast.success("Welcome back!");
    window.location.href = "/";
  };

  // Email / Password submission
  const handleEmailAuth = async (e: React.FormEvent) => {
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

      await handlePostLogin(user, isSignUp);
    } catch (err: unknown) {
      console.error("Email auth error:", err);
      const fbErr = err as { code?: string; message?: string };

      // Helpful automatic handling when an account already exists
      if (
        fbErr.code === 'auth/email-already-in-use' ||
        fbErr.message?.includes('email-already-in-use')
      ) {
        setIsSignUp(false);
        const msg = "This email is already registered! Switched to login mode — enter your passcode to sign in.";
        setError(msg);
        toast(msg, { icon: 'ℹ️' });
        setLoading(false);
        return;
      }

      if (fbErr.code === 'auth/invalid-credential') {
        const msg = isSignUp
          ? "Could not create user account. Please try again."
          : "Invalid email or passcode. If you are new, switch to Register.";
        setError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }

      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Google 1-Click Sign-In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const user = await signInWithGoogle();
      await handlePostLogin(user);
    } catch (err: unknown) {
      const fbErr = err as { code?: string; message?: string };
      if (fbErr.code === 'auth/popup-closed-by-user' || fbErr.code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }

      console.error("Google sign-in error:", err);
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
      toast.error(message);
      setLoading(false);
    }
  };

  // Anonymous / Guest Access
  const handleGuestSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const user = await signInAsGuest();
      await handlePostLogin(user, true);
    } catch (err) {
      console.error("Guest sign-in error:", err);
      const message = err instanceof Error ? err.message : "Guest access failed";
      setError(message);
      toast.error(message);
      setLoading(false);
    }
  };

  // Phone SMS OTP — Send code
  const handleSendPhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setLoading(true);
    setError(null);

    try {
      let verifier = recaptchaVerifier;
      if (!verifier) {
        verifier = await createRecaptchaVerifier('recaptcha-container');
        setRecaptchaVerifier(verifier);
      }
      await sendPhoneOtp(phoneNumber.trim(), verifier);
      setIsCodeSent(true);
      toast.success("Verification code sent via SMS!");
    } catch (err) {
      console.error("Phone send code error:", err);
      const msg = err instanceof Error ? err.message : "Failed to send SMS code. Please check phone format.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Phone SMS OTP — Verify code
  const handleVerifyPhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const user = await verifyPhoneOtp(verificationCode.trim());
      await handlePostLogin(user);
    } catch (err) {
      console.error("Phone verify code error:", err);
      const msg = err instanceof Error ? err.message : "Invalid or expired verification code.";
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  const handleResetPhoneAuth = () => {
    setIsCodeSent(false);
    setVerificationCode('');
    setError(null);
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
      onSubmit={handleEmailAuth}
      onGoogleSignIn={handleGoogleSignIn}
      onGuestSignIn={handleGuestSignIn}
      authMethod={authMethod}
      setAuthMethod={setAuthMethod}
      phoneNumber={phoneNumber}
      setPhoneNumber={setPhoneNumber}
      verificationCode={verificationCode}
      setVerificationCode={setVerificationCode}
      isCodeSent={isCodeSent}
      onSendPhoneCode={handleSendPhoneCode}
      onVerifyPhoneCode={handleVerifyPhoneCode}
      onResetPhoneAuth={handleResetPhoneAuth}
    />
  );
}
