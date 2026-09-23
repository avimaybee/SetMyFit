"use client";

import React, { useState, useRef } from 'react';
import { RetroWindow, RetroButton } from '@/components/retro-ui';
import { processImageUpload } from '@/lib/imageProcessor';
import { toast } from '@/components/ui/toaster';
import { UserPreferences } from '@/types/retro';
import { Upload, ArrowRight, Shirt, CheckCircle, SkipForward } from 'lucide-react';

interface OnboardingFlowProps {
    onComplete: (prefs: Partial<UserPreferences>, firstItem?: { file: File; base64: string }) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [gender, setGender] = useState<'MASC' | 'FEM' | 'NEUTRAL'>('NEUTRAL');
    const [aesthetics, setAesthetics] = useState<string[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [base64Data, setBase64Data] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
            } else {
                toast("3 styles max. Tap one to swap it out.");
            }
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            try {
                // Downscale to ≤1024px WebP (same as the wardrobe form) so the
                // image processing stays fast and lightweight.
                const optimized = await processImageUpload(selectedFile);
                setPreviewUrl(optimized);
                setBase64Data(optimized);
            } catch {
                // Fallback to the raw file if optimization fails
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    setPreviewUrl(result);
                    setBase64Data(result);
                };
                reader.readAsDataURL(selectedFile);
            }
        }
    };

    const handleSkip = async () => {
        setFile(null);
        setPreviewUrl(null);
        setBase64Data(null);
        setStep(3);
        setIsSubmitting(true);
        try {
            const prefs = { preferred_styles: aesthetics, gender };
            await onComplete(prefs);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUploadAndContinue = async () => {
        setStep(3);
        setIsSubmitting(true);
        try {
            const prefs = { preferred_styles: aesthetics, gender };
            if (file && base64Data) {
                await onComplete(prefs, { file, base64: base64Data });
            } else {
                await onComplete(prefs);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStep1 = () => (
        <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
                <h2 className="font-black text-xl sm:text-2xl mb-1 sm:mb-2">QUICK SETUP</h2>
                <p className="font-mono text-xs sm:text-sm text-gray-600">Set your style preferences.</p>
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
                                    p-2.5 sm:p-3 min-h-[44px] text-xs font-mono border-2 border-black transition-all flex items-center justify-center
                                    ${gender === g
                                        ? 'bg-[#FF99C8] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0)] translate-x-[2px] translate-y-[2px]'
                                        : 'bg-white hover:bg-gray-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:scale-[0.98]'}
                                `}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="font-mono text-xs font-bold mb-2 block">STYLE VIBE (Optional, up to 3)</label>
                    <p className="font-mono text-[10px] text-gray-500 mb-2">These influence how outfits are paired</p>
                    <div className="grid grid-cols-2 gap-2">
                        {AESTHETICS.map(style => (
                            <button
                                key={style}
                                onClick={() => toggleAesthetic(style)}
                                className={`
                                    p-2 sm:p-2.5 min-h-[44px] text-xs font-mono border-2 border-black transition-all flex items-center justify-center
                                    ${aesthetics.includes(style)
                                        ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0)] translate-x-[2px] translate-y-[2px]'
                                        : 'bg-white hover:bg-gray-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:scale-[0.98]'}
                                `}
                            >
                                {style}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <RetroButton
                    onClick={() => setStep(2)}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                    NEXT STEP <ArrowRight size={16} />
                </RetroButton>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
                <h2 className="font-black text-xl sm:text-2xl mb-1 sm:mb-2">ADD YOUR FIRST ITEM</h2>
                <p className="font-mono text-xs sm:text-sm text-gray-600">
                    Upload a clothing item to get started, or skip for now.
                </p>
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />

            <div
                role="button"
                tabIndex={0}
                aria-label="Upload your first clothing item"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                    }
                }}
                className={`
                    border-2 border-black border-dashed bg-[#f0f0f0] h-44 sm:h-48 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-[#e5e5e5] transition-colors relative overflow-hidden
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black
                    ${previewUrl ? 'p-0' : 'p-6 sm:p-8'}
                `}
            >
                {previewUrl ? (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <div className="bg-white p-2 border-2 border-black font-mono font-bold text-xs">REPLACE</div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white border-2 border-black rounded-full flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                            <Upload size={22} />
                        </div>
                        <span className="font-mono font-bold text-xs sm:text-sm">BROWSE / CAMERA</span>
                    </>
                )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                <button onClick={() => setStep(1)} className="font-mono text-xs underline py-2 min-h-[36px] order-2 sm:order-1">BACK</button>

                <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2 flex-wrap">
                    <RetroButton
                        onClick={handleSkip}
                        variant="secondary"
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 text-xs"
                    >
                        <SkipForward size={14} /> SKIP FOR NOW
                    </RetroButton>

                    {previewUrl && (
                        <RetroButton
                            onClick={handleUploadAndContinue}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 text-xs"
                        >
                            UPLOAD & CONTINUE <ArrowRight size={16} />
                        </RetroButton>
                    )}
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-6 text-center py-6 animate-in fade-in duration-300">
            <div className="flex justify-center mb-4">
                <Shirt size={48} className="text-[#FF8E72] animate-pulse" />
            </div>

            <h2 className="font-black text-2xl mb-2">SETTING UP YOUR CLOSET</h2>
            <p className="font-mono text-xs text-gray-600">
                {isSubmitting ? 'Saving your style profile...' : 'Your closet is ready!'}
            </p>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
            <div className="max-w-lg w-full my-auto">
                <RetroWindow title="STYLE SETUP" icon={<CheckCircle size={14} />} className="max-h-[90dvh]">
                    <div className="overflow-y-auto max-h-[75dvh] p-1 sm:p-2">
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                    </div>
                    <div className="mt-4 sm:mt-6 flex justify-center gap-1.5 py-1">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`w-2.5 h-2.5 border border-black ${step >= s ? 'bg-black' : 'bg-white'}`}></div>
                        ))}
                    </div>
                </RetroWindow>
            </div>
        </div>
    );
};
