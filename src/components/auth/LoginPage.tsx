import React, { useState } from 'react';
import { RetroButton, RetroInput, RetroWindow } from '@/components/retro-ui';
import { ShieldCheck, Terminal, AlertCircle, Eye, EyeOff, Phone, Mail, UserX, CheckCircle2 } from 'lucide-react';

interface LoginPageProps {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  isSignUp: boolean;
  setIsSignUp: (value: boolean) => void;
  loading: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onGoogleSignIn: () => void;
  onGuestSignIn: () => void;
  // Phone auth
  authMethod: 'email' | 'phone';
  setAuthMethod: (method: 'email' | 'phone') => void;
  phoneNumber: string;
  setPhoneNumber: (value: string) => void;
  verificationCode: string;
  setVerificationCode: (value: string) => void;
  isCodeSent: boolean;
  onSendPhoneCode: (e: React.FormEvent) => void;
  onVerifyPhoneCode: (e: React.FormEvent) => void;
  onResetPhoneAuth: () => void;
}

const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const LoginPage: React.FC<LoginPageProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  isSignUp,
  setIsSignUp,
  loading,
  error,
  onSubmit,
  onGoogleSignIn,
  onGuestSignIn,
  authMethod,
  setAuthMethod,
  phoneNumber,
  setPhoneNumber,
  verificationCode,
  setVerificationCode,
  isCodeSent,
  onSendPhoneCode,
  onVerifyPhoneCode,
  onResetPhoneAuth,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#FFF8E7] p-4 py-8"
      style={{
        backgroundImage: 'radial-gradient(#d0d0d0 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      {/* Invisible container for Firebase Phone Auth reCAPTCHA */}
      <div id="recaptcha-container" />

      <div className="max-w-md w-full my-auto">
        <RetroWindow title="ACCESS_CONTROL.EXE" icon={<ShieldCheck size={14} />}>
          <div className="flex flex-col gap-5 py-3">
            {/* Logo / Header */}
            <div className="text-center border-b-2 border-black border-dashed pb-4">
              <h1 className="font-black text-4xl mb-1 tracking-tighter">
                SET<span className="text-[#FF99C8]">MY</span>FIT
              </h1>
              <p className="font-mono text-xs bg-black text-white inline-block px-2 py-0.5">
                SECURITY LEVEL: PROTOCOL V2
              </p>
            </div>

            {/* Error Message banner */}
            {error && (
              <div className="bg-[#FF8E72] border-2 border-black p-2.5 flex items-start gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="font-mono text-xs font-bold leading-snug">{error}</p>
              </div>
            )}

            {/* Quick 1-Click Providers: Google & Guest */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-black border-2 border-black py-2.5 px-4 font-mono font-bold text-xs uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 cursor-pointer"
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={onGuestSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#FDFFB6] hover:bg-[#f6f89e] text-black border-2 border-black py-2 px-4 font-mono font-bold text-xs uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 cursor-pointer"
              >
                <UserX size={15} />
                <span>Explore as Guest (Anonymous)</span>
              </button>
            </div>

            {/* Retro Divider */}
            <div className="relative flex items-center justify-center my-1">
              <div className="border-t-2 border-black border-dashed w-full" />
              <span className="bg-[#FFF8E7] px-3 font-mono text-[11px] font-bold uppercase tracking-wider text-black shrink-0">
                OR SIGN IN WITH
              </span>
              <div className="border-t-2 border-black border-dashed w-full" />
            </div>

            {/* Method Tabs: Email vs Phone */}
            <div className="grid grid-cols-2 gap-2 border-2 border-black p-1 bg-[#F0F0F0] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <button
                type="button"
                onClick={() => setAuthMethod('email')}
                className={`py-1.5 px-2 flex items-center justify-center gap-1.5 font-mono text-xs font-bold border-2 transition-all cursor-pointer ${
                  authMethod === 'email'
                    ? 'bg-[#A0C4FF] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'border-transparent hover:bg-white/50 text-gray-700'
                }`}
              >
                <Mail size={13} />
                <span>EMAIL</span>
              </button>

              <button
                type="button"
                onClick={() => setAuthMethod('phone')}
                className={`py-1.5 px-2 flex items-center justify-center gap-1.5 font-mono text-xs font-bold border-2 transition-all cursor-pointer ${
                  authMethod === 'phone'
                    ? 'bg-[#FF99C8] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'border-transparent hover:bg-white/50 text-gray-700'
                }`}
              >
                <Phone size={13} />
                <span>PHONE SMS</span>
              </button>
            </div>

            {/* Tab Content: EMAIL/PASSWORD */}
            {authMethod === 'email' && (
              <form onSubmit={onSubmit} className="space-y-4">
                {/* Toggle Register vs Login */}
                <div
                  className="bg-[#A0C4FF] border-2 border-black p-2.5 text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-[#8eb4ff] transition-colors"
                  onClick={() => {
                    if (!loading) setIsSignUp(!isSignUp);
                  }}
                >
                  <p className="font-mono text-xs font-bold text-black">
                    {isSignUp ? 'REGISTERING NEW USER' : 'USER LOGIN'}
                  </p>
                  <p className="font-mono text-[10px] mt-0.5 underline">
                    {isSignUp ? 'Already registered? Switch to Login' : 'Need an account? Switch to Register'}
                  </p>
                </div>

                <div>
                  <label className="font-bold font-mono text-xs uppercase mb-1 block">
                    EMAIL ADDRESS
                  </label>
                  <RetroInput
                    type="email"
                    placeholder="name@domain.com"
                    required
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="font-bold font-mono text-xs uppercase mb-1 block">
                    PASSCODE
                  </label>
                  <div className="relative">
                    <RetroInput
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      required
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="bg-[#CAFFBF] border-2 border-black p-2 flex items-start gap-2">
                  <Terminal size={15} className="mt-0.5 shrink-0" />
                  <p className="font-mono text-[10px] leading-tight">
                    BY ACCESSING THIS TERMINAL, YOU CONSENT TO AI-DRIVEN STYLE OPTIMIZATION PROTOCOLS.
                  </p>
                </div>

                <RetroButton type="submit" disabled={loading} className="w-full py-3">
                  {loading
                    ? 'AUTHENTICATING...'
                    : isSignUp
                    ? 'INITIALIZE NEW USER'
                    : 'ENTER SYSTEM'}
                </RetroButton>
              </form>
            )}

            {/* Tab Content: PHONE SMS OTP */}
            {authMethod === 'phone' && (
              <div className="space-y-4">
                {!isCodeSent ? (
                  <form onSubmit={onSendPhoneCode} className="space-y-4">
                    <div>
                      <label className="font-bold font-mono text-xs uppercase mb-1 block">
                        PHONE NUMBER (WITH COUNTRY CODE)
                      </label>
                      <RetroInput
                        type="tel"
                        placeholder="+1 555 123 4567 or +91 9876543210"
                        required
                        autoComplete="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                      <p className="font-mono text-[10px] text-gray-600 mt-1">
                        Must include country code (e.g. +1 for US, +91 for India).
                      </p>
                    </div>

                    <RetroButton type="submit" disabled={loading || !phoneNumber.trim()} className="w-full py-3">
                      {loading ? 'SENDING SMS...' : 'SEND VERIFICATION CODE'}
                    </RetroButton>
                  </form>
                ) : (
                  <form onSubmit={onVerifyPhoneCode} className="space-y-4">
                    <div className="bg-[#CAFFBF] border-2 border-black p-2 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-green-700 shrink-0" />
                      <p className="font-mono text-[11px] font-bold">
                        OTP sent to {phoneNumber}!
                      </p>
                    </div>

                    <div>
                      <label className="font-bold font-mono text-xs uppercase mb-1 block">
                        6-DIGIT OTP CODE
                      </label>
                      <RetroInput
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="123456"
                        required
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="text-center tracking-widest text-lg font-bold"
                      />
                    </div>

                    <RetroButton type="submit" disabled={loading || verificationCode.length < 6} className="w-full py-3">
                      {loading ? 'VERIFYING CODE...' : 'CONFIRM & ENTER SYSTEM'}
                    </RetroButton>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={onResetPhoneAuth}
                        disabled={loading}
                        className="font-mono text-xs underline text-gray-700 hover:text-black cursor-pointer"
                      >
                        ← Change Phone Number / Resend
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </RetroWindow>
      </div>
    </div>
  );
};
