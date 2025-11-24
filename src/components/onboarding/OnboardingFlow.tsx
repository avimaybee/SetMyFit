"use client";

import React, { useState, useRef, useEffect } from 'react';
import { RetroWindow, RetroButton } from '@/components/retro-ui';
import { UserPreferences } from '@/types/retro';
import { Upload, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';

interface OnboardingFlowProps {
    onComplete: (prefs: Partial<UserPreferences>) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [gender, setGender] = useState<'MASC' | 'FEM' | 'NEUTRAL'>('NEUTRAL');
    const [aesthetics, setAesthetics] = useState<string[]>([]);
    const [_file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const AESTHETICS = [
        'MINIMALIST', 'STREETWEAR', 'VINTAGE', 'TECHWEAR', 
        'GRUNGE', 'PREPPY', 'AVANT-GARDE', 'CASUAL'
    ];

    const toggleAesthetic = (style: string) => {
        if (aesthetics.includes(style)) {
            setAesthetics(aesthetics.filter(a => a !== style));
        } else {
            if (aesthetics.length < 3) {
                setAesthetics([...aesthetics, style]);
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    useEffect(() => {
        if (step === 4) {
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        return 100;
                    }
                    return prev + 2;
                });
            }, 50);
            return () => clearInterval(interval);
        }
    }, [step]);

    const renderStep1 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
                <h2 className="font-black text-2xl mb-2">IDENTITY CONFIG</h2>
                <p className="font-mono text-sm text-gray-600">Select your style parameters.</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="font-mono text-xs font-bold mb-2 block">GENDER EXPRESSION</label>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {(['MASC', 'FEM', 'NEUTRAL'] as const).map(g => (
                            <button
                                key={g}
                                onClick={() => setGender(g)}
                                className={`
                                    p-3 text-xs font-mono border-2 border-black transition-all
                                    ${gender === g
                                        ? 'bg-[#FF99C8] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0)] translate-x-[2px] translate-y-[2px]'
                                        : 'bg-white hover:bg-gray-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}
                                `}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="font-mono text-xs font-bold mb-2 block">STYLE PREFERENCE (MAX 3)</label>
                    <div className="grid grid-cols-2 gap-2">
                        {AESTHETICS.map(style => (
                            <button
                                key={style}
                                onClick={() => toggleAesthetic(style)}
                                className={`
                                    p-2 text-xs font-mono border-2 border-black transition-all
                                    ${aesthetics.includes(style) 
                                        ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0)] translate-x-[2px] translate-y-[2px]' 
                                        : 'bg-white hover:bg-gray-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}
                                `}
                            >
                                {style}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <RetroButton 
                    onClick={() => setStep(2)} 
                    disabled={aesthetics.length === 0}
                    className="flex items-center gap-2"
                >
                    NEXT STEP <ArrowRight size={16} />
                </RetroButton>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
                <h2 className="font-black text-2xl mb-2">UPLOAD CORE ITEM</h2>
                <p className="font-mono text-sm text-gray-600">Add one item to seed the database.</p>
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
            
            <div 
                onClick={() => fileInputRef.current?.click()}
                className={`
                    border-2 border-black border-dashed bg-[#f0f0f0] h-48 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-[#e5e5e5] transition-colors relative overflow-hidden
                    ${previewUrl ? 'p-0' : 'p-8'}
                `}
            >
                {previewUrl ? (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                         <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                             <div className="bg-white p-2 border-2 border-black">REPLACE</div>
                         </div>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-white border-2 border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <Upload size={24} />
                        </div>
                        <span className="font-mono font-bold text-sm">BROWSE / CAMERA</span>
                    </>
                )}
            </div>

            <div className="flex justify-between items-center">
                <button onClick={() => setStep(1)} className="font-mono text-xs underline">BACK</button>
                <RetroButton onClick={() => setStep(4)} className="flex items-center gap-2">
                    SYNC DATABASE <ArrowRight size={16} />
                </RetroButton>
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div className="space-y-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="flex justify-center mb-4">
                <Sparkles size={48} className="text-[#FF8E72] animate-spin-slow" />
            </div>
            
            <h2 className="font-black text-2xl mb-2">INITIALIZING...</h2>
            
            <div className="w-full bg-white border-2 border-black h-6 relative">
                <div 
                    className="bg-[#CAFFBF] h-full absolute top-0 left-0 transition-all duration-100 border-r-2 border-black"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <p className="font-mono text-xs">{progress < 100 ? 'GENERATING NEURAL PATHWAYS...' : 'SYSTEM READY.'}</p>

            {progress === 100 && (
                <RetroButton
                    onClick={() => onComplete({ preferred_styles: aesthetics, gender })}
                    variant="secondary"
                    className="w-full animate-bounce mt-4"
                >
                    ENTER DASHBOARD
                </RetroButton>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="max-w-lg w-full">
                <RetroWindow title="WIZARD.BAT" icon={<CheckCircle size={14} />}>
                    <div className="p-2">
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 4 && renderStep4()}
                    </div>
                    <div className="mt-6 flex justify-center gap-1">
                        {[1, 2].map(s => (
                            <div key={s} className={`w-2 h-2 border border-black ${step >= s ? 'bg-black' : 'bg-white'}`}></div>
                        ))}
                    </div>
                </RetroWindow>
            </div>
        </div>
    );
};
