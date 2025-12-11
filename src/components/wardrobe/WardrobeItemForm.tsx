import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Upload, X, ScanLine, Loader2 } from 'lucide-react';
import { RetroButton, RetroInput, RetroWindow, RetroSelect, RetroSlider, RetroToggle } from '@/components/retro-ui';
import { ClothingItem, ClothingType, ClothingMaterial, Season } from '@/types/retro';
import { processImageUpload } from '@/lib/imageProcessor';
import { dataUrlToFile } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';

interface WardrobeItemFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Partial<ClothingItem>, file?: File) => void;
    initialItem?: ClothingItem | null;
    onAnalyzeImage?: (base64: string, options?: { signal?: AbortSignal }) => Promise<Partial<ClothingItem> | null>;
}

export const WardrobeItemForm: React.FC<WardrobeItemFormProps> = ({
    isOpen,
    onClose,
    onSave,
    initialItem,
    onAnalyzeImage
}) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [processedFile, setProcessedFile] = useState<File | null>(null);
    const processingJobIdRef = useRef(0);
    const analysisAbortControllerRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef(true);

    // Processing State
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [processStatus, setProcessStatus] = useState<string>('IDLE');
    const [removeBgEnabled, setRemoveBgEnabled] = useState(true);

    // Analysis State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(false);

    // Form State
    const [newItemName, setNewItemName] = useState('');
    const [newItemCategory, setNewItemCategory] = useState<ClothingType>('Top');
    const [newItemMaterial, setNewItemMaterial] = useState<ClothingMaterial>('Cotton');
    const [newItemInsulation, setNewItemInsulation] = useState<number>(5);
    const [newItemSeasons, setNewItemSeasons] = useState<Season[]>([]);
    const [newItemStyleTags, setNewItemStyleTags] = useState<string[]>([]);
    const [newItemPattern, setNewItemPattern] = useState<string>('');
    const [newItemFit, setNewItemFit] = useState<string>('Regular');

    const categories: ClothingType[] = ['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessory', 'Dress'];
    const materialOptions: ClothingMaterial[] = ['Cotton', 'Polyester', 'Wool', 'Silk', 'Leather', 'Denim', 'Linen', 'Synthetic', 'Gore-Tex', 'Other'];
    const patternOptions = ['Solid', 'Striped', 'Checkered', 'Plaid', 'Floral', 'Graphic', 'Camo', 'Polka Dot', 'Geometric', 'Animal Print', 'Abstract', 'Other'];
    const fitOptions = ['Fitted', 'Regular', 'Slim', 'Relaxed', 'Oversized', 'Loose', 'Tailored', 'One Size', 'Tight'];

    useEffect(() => {
        if (isOpen) {
            if (initialItem) {
                setNewItemName(initialItem.name);
                setNewItemCategory(initialItem.category);
                setNewItemMaterial(initialItem.material as ClothingMaterial);
                setNewItemInsulation(initialItem.insulation_value);
                setNewItemSeasons(initialItem.season_tags as Season[]);
                setNewItemStyleTags(initialItem.style_tags);
                setNewItemPattern(initialItem.pattern || '');
                setNewItemFit(initialItem.fit || 'Regular');
                setPreviewUrl(initialItem.image_url);
                setIsImageLoading(Boolean(initialItem.image_url));
                setProcessedFile(null);
            } else {
                resetForm();
            }
        }
    }, [isOpen, initialItem]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            processingJobIdRef.current += 1;
            if (analysisAbortControllerRef.current) {
                analysisAbortControllerRef.current.abort();
                analysisAbortControllerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    useEffect(() => {
        if (!previewUrl) {
            setIsImageLoading(false);
        }
    }, [previewUrl]);

    const resetForm = () => {
        setPreviewUrl(null);
        setNewItemName('');
        setNewItemCategory('Top');
        setNewItemMaterial('Cotton');
        setNewItemInsulation(5);
        setNewItemSeasons([]);
        setNewItemStyleTags([]);
        setNewItemPattern('');
        setNewItemFit('Regular');
        setRemoveBgEnabled(true);
        setIsProcessingImage(false);
        setProcessedFile(null);
        setIsImageLoading(false);
    };

    const setPreviewFromFile = (file: File) => {
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        setIsImageLoading(true);
    };

    const handleSaveItem = (e: React.FormEvent) => {
        e.preventDefault();
        const itemPayload: Partial<ClothingItem> = {
            name: newItemName,
            category: newItemCategory,
            material: newItemMaterial,
            insulation_value: newItemInsulation,
            season_tags: newItemSeasons.length > 0 ? newItemSeasons : ['All Season'],
            image_url: previewUrl || '',
            style_tags: newItemStyleTags,
            pattern: newItemPattern || 'Solid',
            fit: newItemFit,
            dress_code: ['Casual'],
        };

        const resolvedFile = processedFile ?? undefined;

        if (initialItem) {
            onSave({ ...itemPayload, id: initialItem.id }, resolvedFile);
        } else {
            onSave({ ...itemPayload, wear_count: 0, is_favorite: false, created_at: new Date().toISOString() }, resolvedFile);
        }

        onClose();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const runAnalysis = async (optimizedBase64: string, currentJobId: number) => {
        if (!onAnalyzeImage || initialItem) return;

        const controller = new AbortController();
        analysisAbortControllerRef.current = controller;

        if (!isMountedRef.current || processingJobIdRef.current !== currentJobId) {
            return;
        }

        setIsAnalyzing(true);

        try {
            const result = await onAnalyzeImage(optimizedBase64, { signal: controller.signal });

            if (controller.signal.aborted) {
                return;
            }

            if (!result) {
                toast('AI analysis unavailable. Please fill fields manually.');
                return;
            }
            if (!isMountedRef.current || processingJobIdRef.current !== currentJobId) {
                return;
            }
            if (result.name) setNewItemName(result.name);
            if (result.category) setNewItemCategory(result.category);
            if (result.material) setNewItemMaterial(result.material as ClothingMaterial);
            if (result.insulation_value !== undefined) setNewItemInsulation(result.insulation_value);
            if (result.season_tags) setNewItemSeasons(result.season_tags as Season[]);
            if (result.style_tags) setNewItemStyleTags(result.style_tags);
            if (result.pattern) setNewItemPattern(result.pattern);
            if (result.fit) setNewItemFit(result.fit);
        } catch (error) {
            if (!controller.signal.aborted) {
                console.error('Error analyzing image:', error);
                toast.error('AI analysis failed. Please fill fields manually.');
            }
        } finally {
            if (analysisAbortControllerRef.current === controller) {
                analysisAbortControllerRef.current = null;
            }
            if (isMountedRef.current && processingJobIdRef.current === currentJobId) {
                setIsAnalyzing(false);
            }
        }
    };

    const processFile = async (file: File) => {
        const currentJobId = ++processingJobIdRef.current;
        const originalName = file.name || 'wardrobe-item.webp';

        // Cancel any ongoing analysis or file reads tied to previous uploads
        if (analysisAbortControllerRef.current) {
            analysisAbortControllerRef.current.abort();
            analysisAbortControllerRef.current = null;
            setIsAnalyzing(false);
        }

        setIsProcessingImage(true);
        setProcessStatus('INITIALIZING');

        const updateStatus = (status: string, percent: number) => {
            if (!isMountedRef.current || processingJobIdRef.current !== currentJobId) {
                return;
            }
            setProcessStatus(`${status} ${percent}%`);
        };

        try {
            const optimizedBase64 = await processImageUpload(file, {
                removeBackground: removeBgEnabled,
                maxWidth: 1024,
                quality: 0.8,
                onProgress: updateStatus
            });

            if (!isMountedRef.current || processingJobIdRef.current !== currentJobId) {
                return;
            }

            let previewFile: File | null = null;
            try {
                const optimizedFile = dataUrlToFile(optimizedBase64, originalName);
                previewFile = optimizedFile;
                if (isMountedRef.current && processingJobIdRef.current === currentJobId) {
                    setProcessedFile(optimizedFile);
                }
            } catch (conversionError) {
                console.error('Failed to convert optimized image to file', conversionError);
                previewFile = file;
                if (isMountedRef.current && processingJobIdRef.current === currentJobId) {
                    setProcessedFile(file);
                }
            }

            if (
                previewFile &&
                isMountedRef.current &&
                processingJobIdRef.current === currentJobId
            ) {
                setPreviewFromFile(previewFile);
            }

            if (isMountedRef.current && processingJobIdRef.current === currentJobId) {
                setIsProcessingImage(false);
            }

            await runAnalysis(optimizedBase64, currentJobId);

        } catch (error) {
            if (!isMountedRef.current || processingJobIdRef.current !== currentJobId) {
                return;
            }

            console.error(error);
            setIsProcessingImage(false);

            if (isMountedRef.current && processingJobIdRef.current === currentJobId) {
                setProcessedFile(file);
                setPreviewFromFile(file);
            }
        } finally {
            if (isMountedRef.current && processingJobIdRef.current === currentJobId) {
                setIsProcessingImage(false);
                setProcessStatus('IDLE');
            }
        }
    }

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const clearImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setPreviewUrl(null);
        setProcessedFile(null);
        if (analysisAbortControllerRef.current) {
            analysisAbortControllerRef.current.abort();
            analysisAbortControllerRef.current = null;
        }
        processingJobIdRef.current += 1;
        setIsAnalyzing(false);
        setIsImageLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const toggleSeason = (season: Season) => {
        if (newItemSeasons.includes(season)) {
            setNewItemSeasons(prev => prev.filter(s => s !== season));
        } else {
            setNewItemSeasons(prev => [...prev, season]);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="max-w-md w-full animate-in zoom-in-95 duration-200">
                <RetroWindow title={initialItem ? "UPDATE_ITEM.EXE" : "NEW_ITEM_WIZARD"} onClose={onClose}>
                    <form onSubmit={handleSaveItem} className="space-y-4 p-2 max-h-[80vh] overflow-y-auto">

                        {/* Image Upload */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/*"
                            className="hidden"
                        />

                        <div className="flex justify-between items-center px-1">
                            <label className="font-bold font-mono text-xs uppercase text-[var(--text)]">Item Image</label>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-[var(--text-muted)]">AI REMOVE BG:</span>
                                <RetroToggle
                                    label=""
                                    checked={removeBgEnabled}
                                    onChange={setRemoveBgEnabled}
                                />
                            </div>
                        </div>

                        <div
                            onClick={triggerFileInput}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            className={`
                                border-2 border-[var(--border)] border-dashed 
                                ${previewUrl ? 'p-0' : 'p-6 bg-[var(--bg-secondary)] hover:bg-[var(--bg-main)]'} 
                                flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-colors relative overflow-hidden min-h-[180px]
                            `}
                        >
                            {previewUrl ? (
                                <>
                                    <div className="relative w-full h-48">
                                        <Image
                                            src={previewUrl}
                                            alt="Preview"
                                            fill
                                            sizes="400px"
                                            className="object-contain bg-[var(--bg-tertiary)]"
                                            onLoadingComplete={() => setIsImageLoading(false)}
                                            onError={() => setIsImageLoading(false)}
                                        />
                                    </div>

                                    {/* Scanning/Processing Overlay */}
                                    {(isAnalyzing || isProcessingImage || isImageLoading) && (
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20 backdrop-blur-sm p-4">
                                            {isProcessingImage ? (
                                                <>
                                                    <Loader2 size={32} className="text-[var(--accent-blue)] animate-spin mb-2" />
                                                    <span className="font-mono font-bold text-[var(--accent-blue)] bg-black px-2 border border-[var(--accent-blue)] text-xs animate-pulse">{processStatus}</span>
                                                </>
                                            ) : isAnalyzing ? (
                                                <>
                                                    <ScanLine size={32} className="text-[#00ff41] animate-bounce mb-2" />
                                                    <span className="font-mono font-bold text-[#00ff41] animate-pulse bg-black px-2 text-xs">ANALYZING METADATA...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Loader2 size={32} className="text-[var(--accent-blue)] animate-spin mb-2" />
                                                    <span className="font-mono font-bold text-[var(--accent-blue)] bg-black px-2 border border-[var(--accent-blue)] text-xs animate-pulse">LOADING PREVIEW...</span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={clearImage}
                                        className="absolute top-2 right-2 bg-[var(--accent-orange)] border-2 border-[var(--border)] p-1 hover:scale-110 transition-transform shadow-[2px_2px_0px_0px_var(--border)] z-10"
                                    >
                                        <X size={16} className="text-white" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    {isProcessingImage ? (
                                        <div className="flex flex-col items-center">
                                            <Loader2 size={32} className="text-[var(--text-muted)] animate-spin" />
                                            <span className="font-mono text-xs mt-2 text-[var(--text)]">{processStatus}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload size={32} className="text-[var(--text-muted)]" />
                                            <span className="font-mono text-xs text-[var(--text-muted)]">CLICK OR DRAG TO UPLOAD</span>
                                            <span className="font-mono text-[9px] bg-[var(--accent-green)] border border-[var(--border)] px-1 text-[var(--text)] mt-1">
                                                {removeBgEnabled ? 'BG REMOVAL ACTIVE' : 'AUTO-OPTIMIZE ON'}
                                            </span>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        <div>
                            <label className="font-bold font-mono text-xs uppercase block mb-1 text-[var(--text)]">Item Name {isAnalyzing && <span className="animate-pulse">...</span>}</label>
                            <RetroInput
                                placeholder="e.g. Vintage Denim Jacket"
                                required
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                disabled={isAnalyzing || isProcessingImage}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="font-bold font-mono text-xs uppercase block mb-1 text-[var(--text)]">Category</label>
                                <RetroSelect value={newItemCategory} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewItemCategory(e.target.value as ClothingType)} disabled={isAnalyzing || isProcessingImage}>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </RetroSelect>
                            </div>
                            <div>
                                <label className="font-bold font-mono text-xs uppercase block mb-1 text-[var(--text)]">Material</label>
                                <RetroSelect value={newItemMaterial} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewItemMaterial(e.target.value as ClothingMaterial)} disabled={isAnalyzing || isProcessingImage}>
                                    {materialOptions.map(m =>
                                        <option key={m} value={m}>{m}</option>
                                    )}
                                </RetroSelect>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="font-bold font-mono text-xs uppercase block mb-1 text-[var(--text)]">Pattern</label>
                                <RetroSelect value={newItemPattern} onChange={(e) => setNewItemPattern(e.target.value)} disabled={isAnalyzing || isProcessingImage}>
                                    {patternOptions.map(p =>
                                        <option key={p} value={p}>{p}</option>
                                    )}
                                </RetroSelect>
                            </div>
                            <div>
                                <label className="font-bold font-mono text-xs uppercase block mb-1 text-[var(--text)]">Fit</label>
                                <RetroSelect value={newItemFit} onChange={(e) => setNewItemFit(e.target.value)} disabled={isAnalyzing || isProcessingImage}>
                                    {fitOptions.map(f =>
                                        <option key={f} value={f}>{f}</option>
                                    )}
                                </RetroSelect>
                            </div>

                            {/* Insulation slider hidden - no longer used by recommendation engine */}
                        </div>

                        <div>
                            <label className="font-bold font-mono text-xs uppercase block mb-1 text-[var(--text)]">Seasons</label>
                            <div className="flex flex-wrap gap-2">
                                {['Spring', 'Summer', 'Autumn', 'Winter'].map((season) => (
                                    <button
                                        type="button"
                                        key={season}
                                        onClick={() => toggleSeason(season as Season)}
                                        disabled={isAnalyzing || isProcessingImage}
                                        className={`px-2 py-1 border-2 border-[var(--border)] font-mono text-xs ${newItemSeasons.includes(season as Season) ? 'bg-[var(--accent-green)] text-[var(--text)]' : 'bg-[var(--bg-secondary)] text-[var(--text)]'}`}
                                    >
                                        {season}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {newItemStyleTags.length > 0 && (
                            <div>
                                <label className="font-bold font-mono text-xs uppercase block mb-1 text-[var(--text)]">Detected Tags</label>
                                <div className="flex flex-wrap gap-1">
                                    {newItemStyleTags.map(tag => (
                                        <span key={tag} className="text-[9px] bg-[var(--bg-main)] border border-[var(--border)] px-1 text-[var(--text)]">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-2">
                            <RetroButton type="submit" className="w-full py-2" disabled={isAnalyzing || isProcessingImage || !previewUrl}>
                                {isAnalyzing ? 'PROCESSING IMAGE...' : (initialItem ? 'UPDATE ITEM' : 'SAVE TO DATABASE')}
                            </RetroButton>
                        </div>
                    </form>
                </RetroWindow>
            </div>
        </div>
    );
};
