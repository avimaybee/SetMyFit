import React, { useState } from 'react';
import { RetroButton, RetroInput, RetroWindow } from '@/components/retro-ui';
import {
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Phone,
  Mail,
  UserX,
  CheckCircle2,
  CloudSun,
  Sparkles,
  Layers,
  Thermometer,
  ArrowRight
} from 'lucide-react';

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
      className="min-h-screen flex items-center justify-center bg-[#FFF8E7] px-3 py-6 sm:px-6 md:px-8 lg:px-12 relative overflow-x-hidden"
      style={{
        backgroundImage: 'radial-gradient(#d0d0d0 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      {/* Invisible container for Firebase Phone Auth reCAPTCHA */}
      <div id="recaptcha-container" />

      <div className="max-w-6xl w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
          
          {/* ============================================================ */}
          {/* DESKTOP SHOWCASE (Left 7 Cols on Desktop, Hidden on Mobile) */}
          {/* ============================================================ */}
          <div className="hidden lg:flex lg:col-span-7 flex-col gap-6 justify-center">
            
            {/* Brand Intro & Headline */}
            <div>
              <div className="inline-flex items-center gap-2 bg-[var(--accent-yellow)] border-2 border-black px-2.5 py-1 mb-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Sparkles size={14} className="text-black" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-black">
                  DAILY FIT OS // V2.0.0
                </span>
              </div>
              <h1 className="font-black text-4xl xl:text-5xl tracking-tight leading-[1.05] text-black uppercase mb-3">
                DRESS WITH INTENTION. <br />
                <span className="text-[#FF6B6B] drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  ZERO GUESSWORK.
                </span>
              </h1>
              <p className="font-mono text-sm text-gray-700 max-w-lg leading-relaxed">
                Connect your actual clothes with real-time weather and occasion rules.
                Deterministic logic and intelligent styling curate outfits that actually work.
              </p>
            </div>

            {/* Interactive / Tangible Curation Preview Card */}
            <div className="max-w-lg w-full">
              <RetroWindow
                title="TODAY'S CURATION"
                icon={<Layers size={14} />}
                headerColor="bg-[#A0C4FF]"
                className="shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
              >
                <div className="p-3 bg-white space-y-3">
                  {/* Status Bar */}
                  <div className="flex items-center justify-between bg-[#FFF8E7] border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-green-700">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      <span>MATCH: 96%</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-black px-2 py-0.5 font-mono text-[10px] font-bold">
                      <CloudSun size={12} className="text-orange-500" />
                      <span>18°C · PARTLY CLOUDY</span>
                    </div>
                    <span className="bg-[#FF99C8] border border-black px-1.5 py-0.5 font-mono text-[10px] font-bold">
                      CASUAL SMART
                    </span>
                  </div>

                  {/* Mock Garment Strips */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#FFF8E7] border-2 border-black p-2 flex flex-col justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <div className="w-full aspect-square bg-[#3F4E4F] border border-black mb-1.5 flex items-center justify-center text-white text-[10px] font-mono font-bold">
                        LAYER
                      </div>
                      <span className="font-bold text-[11px] leading-tight truncate">Cotton Overshirt</span>
                      <div className="flex items-center justify-between text-[9px] font-mono text-gray-600 mt-1">
                        <span className="flex items-center gap-0.5"><Thermometer size={9} /> Lvl.5</span>
                        <span className="bg-white border border-black px-0.5">XP: 14</span>
                      </div>
                    </div>

                    <div className="bg-[#FFF8E7] border-2 border-black p-2 flex flex-col justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <div className="w-full aspect-square bg-[#DCD7C9] border border-black mb-1.5 flex items-center justify-center text-black text-[10px] font-mono font-bold">
                        BASE
                      </div>
                      <span className="font-bold text-[11px] leading-tight truncate">Waffle Knit Tee</span>
                      <div className="flex items-center justify-between text-[9px] font-mono text-gray-600 mt-1">
                        <span className="flex items-center gap-0.5"><Thermometer size={9} /> Lvl.2</span>
                        <span className="bg-white border border-black px-0.5">XP: 28</span>
                      </div>
                    </div>

                    <div className="bg-[#FFF8E7] border-2 border-black p-2 flex flex-col justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <div className="w-full aspect-square bg-[#2C3639] border border-black mb-1.5 flex items-center justify-center text-white text-[10px] font-mono font-bold">
                        BOTTOM
                      </div>
                      <span className="font-bold text-[11px] leading-tight truncate">Pleated Chino</span>
                      <div className="flex items-center justify-between text-[9px] font-mono text-gray-600 mt-1">
                        <span className="flex items-center gap-0.5"><Thermometer size={9} /> Lvl.4</span>
                        <span className="bg-white border border-black px-0.5">XP: 19</span>
                      </div>
                    </div>
                  </div>

                  {/* Styling Note */}
                  <div className="bg-[#f0f0f0] border-2 border-black p-2 font-mono text-[11px] text-gray-800 leading-snug">
                    <span className="font-bold text-black uppercase">Styling Notes:</span> Balanced earth tones with breathable base and structured layer, tuned for breezy midday shifts.
                  </div>
                </div>
              </RetroWindow>
            </div>

            {/* Feature Highlights Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="bg-white border-2 border-black px-3 py-1 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                🌦 REAL WEATHER SYNC
              </span>
              <span className="bg-white border-2 border-black px-3 py-1 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                🔒 PRIVATE & LOCAL-FIRST
              </span>
              <span className="bg-white border-2 border-black px-3 py-1 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                🎯 HONEST CURATION
              </span>
            </div>
          </div>

          {/* ============================================================ */}
          {/* SIGN IN FORM (Right 5 Cols on Desktop, Full on Mobile) */}
          {/* ============================================================ */}
          <div className="w-full max-w-md mx-auto lg:max-w-none lg:col-span-5">
            <RetroWindow
              title={isSignUp ? "CREATE ACCOUNT" : "SIGN IN"}
              icon={<ShieldCheck size={14} />}
              headerColor="bg-[#FF99C8]"
              className="shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
            >
              <div className="flex flex-col gap-3 py-1 sm:py-2">
                
                {/* Mobile Header (Hidden on Desktop) */}
                <div className="text-center lg:hidden border-b-2 border-black border-dashed pb-2.5">
                  <h2 className="font-black text-2xl sm:text-3xl tracking-tighter">
                    SET<span className="text-[#FF99C8]">MY</span>FIT
                  </h2>
                  <p className="font-mono text-[10px] bg-black text-white inline-block px-2 py-0.5 mt-1">
                    DAILY CLOSET CURATOR
                  </p>
                </div>

                {/* Primary Mode Switcher Tabs */}
                <div className="grid grid-cols-2 gap-1 bg-[#F0F0F0] border-2 border-black p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <button
                    type="button"
                    onClick={() => {
                      if (!loading) setIsSignUp(false);
                    }}
                    className={`py-2 px-2 min-h-[40px] text-center font-mono text-xs font-bold transition-all cursor-pointer border-2 ${
                      !isSignUp
                        ? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'border-transparent text-gray-700 hover:text-black hover:bg-white/60'
                    }`}
                  >
                    SIGN IN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!loading) setIsSignUp(true);
                    }}
                    className={`py-2 px-2 min-h-[40px] text-center font-mono text-xs font-bold transition-all cursor-pointer border-2 ${
                      isSignUp
                        ? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'border-transparent text-gray-700 hover:text-black hover:bg-white/60'
                    }`}
                  >
                    CREATE ACCOUNT
                  </button>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="bg-[#FF8E72] border-2 border-black p-2.5 flex items-start gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-in fade-in duration-200">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-black" />
                    <p className="font-mono text-xs font-bold text-black leading-snug">{error}</p>
                  </div>
                )}

                {/* 1-Click Providers: Google & Guest */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-black border-2 border-black py-2.5 px-3 font-mono font-bold text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <GoogleIcon />
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={onGuestSignIn}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 bg-[#FDFFB6] hover:bg-[#f6f89e] text-black border-2 border-black py-2.5 px-3 font-mono font-bold text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <UserX size={14} />
                    <span>Guest Mode</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-0.5">
                  <div className="border-t-2 border-black border-dashed w-full" />
                  <span className="bg-[#FFF8E7] px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-gray-700 shrink-0">
                    OR WITH
                  </span>
                  <div className="border-t-2 border-black border-dashed w-full" />
                </div>

                {/* Method Switch: Email vs Phone */}
                <div className="flex border-2 border-black p-0.5 bg-[#F0F0F0]">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('email')}
                    className={`flex-1 py-1 px-2 flex items-center justify-center gap-1.5 font-mono text-xs font-bold border-2 transition-all cursor-pointer ${
                      authMethod === 'email'
                        ? 'bg-[#A0C4FF] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'border-transparent text-gray-600 hover:text-black'
                    }`}
                  >
                    <Mail size={13} />
                    <span>EMAIL</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthMethod('phone')}
                    className={`flex-1 py-1 px-2 flex items-center justify-center gap-1.5 font-mono text-xs font-bold border-2 transition-all cursor-pointer ${
                      authMethod === 'phone'
                        ? 'bg-[#FF99C8] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'border-transparent text-gray-600 hover:text-black'
                    }`}
                  >
                    <Phone size={13} />
                    <span>PHONE SMS</span>
                  </button>
                </div>

                {/* Tab: EMAIL & PASSWORD FORM */}
                {authMethod === 'email' && (
                  <form onSubmit={onSubmit} className="space-y-3">
                    <div>
                      <label className="font-bold font-mono text-xs uppercase mb-1 flex items-center justify-between">
                        <span>Email Address</span>
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
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold font-mono text-xs uppercase">
                          Passcode
                        </label>
                        {isSignUp && (
                          <span className="font-mono text-[10px] text-gray-500">Min. 6 characters</span>
                        )}
                      </div>
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black cursor-pointer p-1"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <RetroButton
                      type="submit"
                      disabled={loading}
                      variant="primary"
                      className="w-full py-3 flex items-center justify-center gap-2 text-xs md:text-sm uppercase tracking-wide mt-2"
                    >
                      {loading ? (
                        'VERIFYING...'
                      ) : (
                        <>
                          <span>{isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}</span>
                          <ArrowRight size={15} />
                        </>
                      )}
                    </RetroButton>
                  </form>
                )}

                {/* Tab: PHONE SMS OTP FORM */}
                {authMethod === 'phone' && (
                  <div className="space-y-3">
                    {!isCodeSent ? (
                      <form onSubmit={onSendPhoneCode} className="space-y-3">
                        <div>
                          <label className="font-bold font-mono text-xs uppercase mb-1 block">
                            Phone Number
                          </label>
                          <RetroInput
                            type="tel"
                            placeholder="+1 555 123 4567"
                            required
                            autoComplete="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                          />
                          <p className="font-mono text-[10px] text-gray-500 mt-1">
                            Include country code (+1, +91, +44, etc.)
                          </p>
                        </div>

                        <RetroButton
                          type="submit"
                          disabled={loading || !phoneNumber.trim()}
                          variant="primary"
                          className="w-full py-3 flex items-center justify-center gap-2 text-xs uppercase"
                        >
                          {loading ? 'SENDING SMS...' : 'SEND VERIFICATION CODE'}
                        </RetroButton>
                      </form>
                    ) : (
                      <form onSubmit={onVerifyPhoneCode} className="space-y-3">
                        <div className="bg-[#CAFFBF] border-2 border-black p-2 flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-green-700 shrink-0" />
                          <p className="font-mono text-[11px] font-bold">
                            OTP sent to {phoneNumber}!
                          </p>
                        </div>

                        <div>
                          <label className="font-bold font-mono text-xs uppercase mb-1 block">
                            6-Digit OTP Code
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

                        <RetroButton
                          type="submit"
                          disabled={loading || verificationCode.length < 6}
                          variant="primary"
                          className="w-full py-3 flex items-center justify-center gap-2 text-xs uppercase"
                        >
                          {loading ? 'VERIFYING CODE...' : 'VERIFY & ENTER'}
                        </RetroButton>

                        <div className="text-center pt-1">
                          <button
                            type="button"
                            onClick={onResetPhoneAuth}
                            disabled={loading}
                            className="font-mono text-xs underline text-gray-600 hover:text-black cursor-pointer"
                          >
                            ← Change Phone Number / Resend
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* Bottom Helper Switcher */}
                <div className="text-center border-t border-black border-dashed pt-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!loading) setIsSignUp(!isSignUp);
                    }}
                    className="font-mono text-xs text-gray-600 hover:text-black underline cursor-pointer"
                  >
                    {isSignUp
                      ? 'Already have an account? Sign in here'
                      : "Don't have an account? Create one in seconds"}
                  </button>
                </div>

              </div>
            </RetroWindow>
          </div>

        </div>
      </div>
    </div>
  );
};

