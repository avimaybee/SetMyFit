import React, { useState } from 'react';
import { RetroButton, RetroInput, RetroWindow } from '@/components/retro-ui';
import { ShieldCheck, Terminal, AlertCircle, Eye, EyeOff } from 'lucide-react';

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
}

export const LoginPage: React.FC<LoginPageProps> = ({ 
    email, setEmail, password, setPassword, isSignUp, setIsSignUp, loading, error, onSubmit 
}) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FFF8E7] p-4" 
             style={{ backgroundImage: 'radial-gradient(#e5e5e5 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            
            <div className="max-w-md w-full">
                <RetroWindow title="ACCESS_CONTROL.EXE" icon={<ShieldCheck size={14}/>}>
                    <form onSubmit={onSubmit} className="flex flex-col gap-6 py-4">
                        
                        <div className="text-center border-b-2 border-black border-dashed pb-6">
                            <h1 className="font-black text-4xl mb-2 tracking-tighter">SET<span className="text-[#FF99C8]">MY</span>FIT</h1>
                            <p className="font-mono text-xs bg-black text-white inline-block px-2 py-1">SECURITY LEVEL: MAX</p>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-[#A0C4FF] border-2 border-black p-3 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-[#8eb4ff] transition-colors"
                                 onClick={() => setIsSignUp(!isSignUp)}>
                                <p className="font-mono text-xs font-bold text-black">
                                    {isSignUp ? "REGISTERING NEW USER" : "USER LOGIN"}
                                </p>
                                <p className="font-mono text-[10px] mt-1 underline">
                                    {isSignUp ? "Switch to Login" : "Switch to Register"}
                                </p>
                            </div>

                            {error && (
                                <div className="bg-[#FF8E72] border-2 border-black p-2 flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    <p className="font-mono text-xs font-bold">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="font-bold font-mono text-xs uppercase mb-1 block">EMAIL ADDRESS</label>
                                <RetroInput 
                                    type="email" 
                                    placeholder="ENTER EMAIL..." 
                                    required 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="font-bold font-mono text-xs uppercase mb-1 block">PASSCODE</label>
                                <div className="relative">
                                    <RetroInput 
                                        type={showPassword ? "text" : "password"} 
                                        placeholder="••••••••" 
                                        required 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#CAFFBF] border-2 border-black p-2 flex items-start gap-2">
                            <Terminal size={16} className="mt-0.5 shrink-0" />
                            <p className="font-mono text-[10px] leading-tight">
                                BY ACCESSING THIS TERMINAL, YOU CONSENT TO AI-DRIVEN STYLE OPTIMIZATION PROTOCOLS.
                            </p>
                        </div>

                        <RetroButton type="submit" disabled={loading} className="w-full py-3">
                            {loading ? 'AUTHENTICATING...' : (isSignUp ? 'INITIALIZE USER' : 'ENTER SYSTEM')}
                        </RetroButton>

                        <div className="text-center">
                             <button type="button" className="text-xs font-mono underline text-gray-500 hover:text-black">FORGOT CREDENTIALS?</button>
                        </div>
                    </form>
                </RetroWindow>
            </div>
        </div>
    );
};
