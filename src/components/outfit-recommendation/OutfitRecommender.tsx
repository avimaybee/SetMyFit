import React, { useState, useMemo, useEffect } from 'react';
import { RefreshCcw, ThumbsUp, ThumbsDown, CheckCircle, Sparkles, Loader2, BrainCircuit, ChevronDown, ChevronUp, Thermometer, Lock, Unlock, Upload } from 'lucide-react';
import { RetroWindow, RetroButton, RetroBadge, RetroImage } from '../retro-ui';
import { ClothingItem, Outfit, ClothingType } from '@/types/retro';

interface OutfitRecommenderProps {
    items: ClothingItem[];
    suggestedOutfit: Outfit | null;
    isGenerating: boolean;
    generationProgress?: number;
    onGenerate: () => void;
    onLogOutfit: (items: ClothingItem[]) => void;
    onOutfitChange?: (items: ClothingItem[]) => void;
    lockedItems?: string[];
    onToggleLock?: (itemId: string) => void;
    isLogging?: boolean;
    isLoadingWardrobe?: boolean;  // NEW: Distinguish loading from empty
    onNavigateToWardrobe?: () => void;  // NEW: Action for empty state
    recommendationId?: string | number | null;  // Saved recommendation id for feedback
    onFeedback?: (isLiked: boolean, reason?: string) => void | Promise<void>;  // Like/dislike handler
}

interface OrganizedOutfit {
    coreTops: ClothingItem[];  // Array to support layered tops
    coreBottom?: ClothingItem;
    coreShoes?: ClothingItem;
    coreDress?: ClothingItem;  // One-piece: satisfies top + bottom slots
    outerwear?: ClothingItem;
    accessories: ClothingItem[];
}

export const OutfitRecommender: React.FC<OutfitRecommenderProps> = ({
    items,
    suggestedOutfit,
    isGenerating,
    generationProgress = 0,
    onGenerate,
    onLogOutfit,
    onOutfitChange,
    lockedItems = [],
    onToggleLock,
    isLogging = false,
    isLoadingWardrobe = false,
    onNavigateToWardrobe,
    recommendationId = null,
    onFeedback
}) => {
    const [isSwapping, setIsSwapping] = useState(false);
    const [activeSwapCategory, setActiveSwapCategory] = useState<ClothingType | null>(null);
    const [showReasoning, setShowReasoning] = useState(true);
    const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(null);
    const [showReasons, setShowReasons] = useState(false);
    const [feedbackBusy, setFeedbackBusy] = useState(false);

    // A new recommendation resets the rating UI.
    useEffect(() => {
        setFeedback(null);
        setShowReasons(false);
    }, [recommendationId]);

    const submitFeedback = async (isLiked: boolean, reason?: string) => {
        if (!onFeedback || feedbackBusy || feedback) return;
        setFeedbackBusy(true);
        try {
            await onFeedback(isLiked, reason);
            setFeedback(isLiked ? 'liked' : 'disliked');
            setShowReasons(false);
        } finally {
            setFeedbackBusy(false);
        }
    };

    const displaySet: OrganizedOutfit = useMemo(() => {
        const set: OrganizedOutfit = { coreTops: [], accessories: [] };

        // Deep copy to avoid mutation
        // Normalize incoming items' category values so DB variations don't break UI logic
        const normalizeCategory = (itm: ClothingItem): ClothingItem => {
            const cat = (itm.category || itm.type || '').toString();
            let resolved: ClothingType = 'Top';
            switch (cat.toLowerCase()) {
                case 'footwear':
                case 'shoes':
                    resolved = 'Shoes';
                    break;
                case 'headwear':
                case 'head':
                case 'hat':
                case 'accessory':
                    resolved = 'Accessory';
                    break;
                case 'outerwear':
                case 'coat':
                case 'jacket':
                    resolved = 'Outerwear';
                    break;
                case 'bottom':
                case 'pants':
                case 'trousers':
                    resolved = 'Bottom';
                    break;
                case 'dress':
                    resolved = 'Dress';
                    break;
                case 'top':
                default:
                    resolved = 'Top';
            }
            return { ...itm, category: resolved } as ClothingItem;
        };

        const sourceItems = suggestedOutfit ? [...suggestedOutfit.items.map(normalizeCategory)] : [...items.map(normalizeCategory)];

        const extract = (cat: ClothingType) => {
            const idx = sourceItems.findIndex(i => i.category === cat);
            if (idx !== -1) {
                const [item] = sourceItems.splice(idx, 1);
                return item;
            }
            return undefined;
        };

        // Extract ALL tops (for layered looks - base tee + overshirt + jacket)
        const extractAll = (cat: ClothingType): ClothingItem[] => {
            const items: ClothingItem[] = [];
            let idx = sourceItems.findIndex(i => i.category === cat);
            while (idx !== -1) {
                const [item] = sourceItems.splice(idx, 1);
                items.push(item);
                idx = sourceItems.findIndex(i => i.category === cat);
            }
            return items;
        };

        // Priority extraction based on category
        set.coreTops = extractAll('Top');  // Get ALL tops for layering
        set.coreBottom = extract('Bottom');
        set.coreShoes = extract('Shoes');
        set.coreDress = extract('Dress');
        set.outerwear = extract('Outerwear');

        // Anything left with category 'Accessory' goes to accessories
        set.accessories = sourceItems.filter(i => i.category === 'Accessory');

        // Fallback for empty state (Home Screen initial) OR partial outfit - search normalized incoming items
        if (items.length > 0 && (set.coreTops.length === 0 || !set.coreBottom || !set.coreShoes)) {
            const normalized = items.map(normalizeCategory);
            if (set.coreTops.length === 0 && !set.coreDress) {
                const foundTop = normalized.find(i => i.category === 'Top');
                if (foundTop) set.coreTops = [foundTop];
                else set.coreDress = normalized.find(i => i.category === 'Dress');
            }
            if (!set.coreBottom && !set.coreDress) set.coreBottom = normalized.find(i => i.category === 'Bottom');
            if (!set.coreShoes) set.coreShoes = normalized.find(i => i.category === 'Shoes');
        }

        return set;
    }, [suggestedOutfit, items]);

    const getCurrentItems = () => {
        const list: ClothingItem[] = [];
        if (displaySet.coreTops.length > 0) list.push(...displaySet.coreTops);
        if (displaySet.coreBottom) list.push(displaySet.coreBottom);
        if (displaySet.coreDress) list.push(displaySet.coreDress);
        if (displaySet.coreShoes) list.push(displaySet.coreShoes);
        if (displaySet.outerwear) list.push(displaySet.outerwear);
        if (displaySet.accessories) list.push(...displaySet.accessories);
        return list;
    };

    const handleLogClick = () => {
        if (isLogging) {
            return;
        }
        // Always delegate: the parent toasts when there is nothing to log.
        onLogOutfit(getCurrentItems());
    };

    const openSwapModal = (category: ClothingType) => {
        setActiveSwapCategory(category);
        setIsSwapping(true);
    };

    const handleSwapItem = (newItem: ClothingItem) => {
        const currentItems = getCurrentItems();
        // Remove the item that occupies the current slot (if any).
        // A dress is one-piece: swapping one in clears Top/Bottom, and
        // swapping a Top/Bottom in clears a dress.
        const newCat = newItem.category;
        const filtered = currentItems.filter(i => {
            if (i.category === activeSwapCategory) return false;
            if (newCat === 'Dress' && (i.category === 'Top' || i.category === 'Bottom' || i.category === 'Dress')) return false;
            if ((newCat === 'Top' || newCat === 'Bottom') && i.category === 'Dress') return false;
            return true;
        });

        const newOutfitItems = [...filtered, newItem];
        onOutfitChange?.(newOutfitItems);

        // Smart Auto-Lock: Lock the manually selected item
        if (onToggleLock && !lockedItems.includes(newItem.id)) {
            onToggleLock(newItem.id);
        }

        setIsSwapping(false);
    };

    // Check usable items after normalization; require at least Top, Bottom and Shoes available
    const normalizeCategoryForList = (itm: ClothingItem): ClothingItem => {
        const cat = (itm.category || itm.type || '').toString();
        switch (cat.toLowerCase()) {
            case 'footwear':
            case 'shoes':
                return { ...itm, category: 'Shoes' } as ClothingItem;
            case 'headwear':
            case 'head':
            case 'hat':
            case 'accessory':
                return { ...itm, category: 'Accessory' } as ClothingItem;
            case 'outerwear':
            case 'coat':
            case 'jacket':
                return { ...itm, category: 'Outerwear' } as ClothingItem;
            case 'bottom':
            case 'pants':
            case 'trousers':
                return { ...itm, category: 'Bottom' } as ClothingItem;
            case 'dress':
                return { ...itm, category: 'Dress' } as ClothingItem;
            case 'top':
            default:
                return { ...itm, category: 'Top' } as ClothingItem;
        }
    };

    const normalizedItems = items.map(normalizeCategoryForList);
    const coreCategoriesPresent = new Set(normalizedItems.filter(i => ['Top', 'Bottom', 'Shoes'].includes(i.category)).map(i => i.category));
    // A dress is one-piece: it satisfies both the Top and Bottom slots.
    if (normalizedItems.some(i => i.category === 'Dress')) {
        coreCategoriesPresent.add('Top');
        coreCategoriesPresent.add('Bottom');
    }

    // Show loading spinner ONLY when actually loading
    if (isLoadingWardrobe) {
        return (
            <RetroWindow title="OUTFIT_GEN.EXE" className="h-full flex flex-col" headerColor="bg-[#FF99C8]">
                {/* Status Bar - Integrated Loading Feedback */}
                <div className="flex flex-row justify-between items-center bg-white border-2 border-black p-2 mb-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] gap-2">
                    <div className="flex items-center gap-2 flex-1">
                        <Loader2 size={16} className="animate-spin text-[#FF99C8]" />
                        <div className="flex flex-col">
                            <p className="font-mono text-[10px] md:text-xs font-bold tracking-tight text-gray-800 uppercase">
                                INIT_WARDROBE_DATA...
                            </p>
                            <div className="w-32 h-1.5 border border-black bg-gray-100 overflow-hidden mt-0.5">
                                <div className="h-full bg-[#CAFFBF] animate-[width_2s_ease-in-out_infinite]" style={{ width: '45%' }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Canvas - "Wireframe" Layout */}
                <div className="flex-1 bg-[#f0f0f0] border-2 border-black relative p-4 flex items-center justify-center min-h-[350px] overflow-hidden">
                    {/* Scanline pattern overlay */}
                    <div className="absolute inset-0 z-20 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}></div>
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>

                    <div className="relative z-10 grid grid-cols-[70px_1fr_80px] md:grid-cols-[120px_1fr_120px] gap-4 items-center w-full h-full">
                        {/* Left - Accessories skeleton */}
                        <div className="h-full border-2 border-black/10 bg-black/5 rounded-lg p-2 flex flex-col gap-3 justify-center">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-white border-2 border-black/10 self-center animate-pulse" />
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-white border-2 border-black/10 self-center animate-pulse delay-75" />
                        </div>

                        {/* Center - Core Items skeleton */}
                        <div className="flex flex-col gap-3 items-center w-full">
                            <div className="w-full max-w-[160px] md:max-w-[200px]">
                                <div className="w-full aspect-square bg-white border-2 border-black/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] animate-pulse" />
                                <div className="h-6 bg-black/5 border-2 border-black/10 border-t-0" />
                            </div>
                            <div className="w-full max-w-[160px] md:max-w-[200px]">
                                <div className="w-full aspect-[4/5] bg-white border-2 border-black/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] animate-pulse delay-100" />
                                <div className="h-6 bg-black/5 border-2 border-black/10 border-t-0" />
                            </div>
                        </div>

                        {/* Right - Layer & Shoes skeleton */}
                        <div className="flex flex-col h-full justify-between py-4 items-end">
                            <div className="flex flex-col items-end gap-1">
                                <div className="w-16 h-16 md:w-24 md:h-24 bg-white border-2 border-black/10 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.05)] animate-pulse delay-150" />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="w-20 h-20 md:w-28 md:h-28 bg-white border-2 border-black/10 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.05)] animate-pulse delay-200" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Logic Gate / System Log skeleton */}
                <div className="bg-[#e5e5e5] border-2 border-black mt-2">
                    <div className="p-2 bg-white flex items-center justify-between border-b border-black/10">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 bg-green-400 animate-pulse border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]" />
                            <div className="h-3 w-32 bg-gray-100 border border-black/10" />
                        </div>
                    </div>
                    <div className="p-2 space-y-1">
                        <div className="h-1.5 w-full bg-black/5" />
                        <div className="h-1.5 w-[80%] bg-black/5" />
                    </div>
                </div>

                {/* Footer Controls skeleton */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="h-10 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-pulse" />
                    <div className="h-10 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-pulse delay-75" />
                </div>
            </RetroWindow>
        );
    }

    // Empty wardrobe - show welcoming onboarding prompt
    if (items.length === 0) {
        return (
            <RetroWindow title="OUTFIT_GEN.EXE" className="h-full flex items-center justify-center text-center p-6">
                <div className="flex flex-col items-center gap-6 max-w-sm">
                    <div className="w-20 h-20 bg-[#CAFFBF] border-2 border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <Sparkles size={40} className="text-black" />
                    </div>
                    <div>
                        <h2 className="font-black text-2xl mb-2">WELCOME!</h2>
                        <p className="font-mono text-sm text-gray-600">
                            Your wardrobe is empty. Add a few pieces to start building outfits.
                        </p>
                    </div>
                    <RetroButton
                        onClick={onNavigateToWardrobe}
                        className="flex items-center gap-2"
                    >
                        <Upload size={16} /> ADD YOUR FIRST ITEM
                    </RetroButton>
                </div>
            </RetroWindow>
        );
    }

    if (coreCategoriesPresent.size < 3) {
        return (
            <RetroWindow title="OUTFIT_GEN.EXE" className="h-full flex items-center justify-center text-center p-6">
                <div className="flex flex-col items-center gap-4 max-w-sm">
                    <h2 className="font-black text-xl mb-2">ALMOST THERE!</h2>
                    <p className="font-mono text-sm mb-2">
                        To generate complete outfits, you need at least one item from each core category:
                    </p>
                    <div className="flex gap-2 flex-wrap justify-center mb-2">
                        {(['Top', 'Bottom', 'Shoes'] as ClothingType[]).map(cat => (
                            <span
                                key={cat}
                                className={`px-2 py-1 text-xs font-mono border-2 border-black ${coreCategoriesPresent.has(cat)
                                    ? 'bg-[#CAFFBF]'
                                    : 'bg-[#FF99C8]'
                                    }`}
                            >
                                {cat.toUpperCase()} {coreCategoriesPresent.has(cat) ? '✓' : '✗'}
                            </span>
                        ))}
                    </div>
                    <p className="font-mono text-xs text-gray-500">
                        Found: {Array.from(coreCategoriesPresent).join(', ') || 'none'}
                    </p>
                    <RetroButton onClick={onNavigateToWardrobe} className="flex items-center gap-2">
                        <Upload size={16} /> ADD MISSING ITEMS
                    </RetroButton>
                </div>
            </RetroWindow>
        );
    }

    const { coreTops, coreBottom, coreShoes, coreDress, outerwear, accessories } = displaySet;

    // If a core slot is missing after all fallback attempts, show helpful message instead of rendering nothing.
    // A dress satisfies both the top and bottom slots.
    if ((coreTops.length === 0 && !coreDress) || (!coreBottom && !coreDress) || !coreShoes) {
        return (
            <RetroWindow title="OUTFIT_GEN.EXE" className="h-full flex items-center justify-center text-center p-6">
                <div>
                    <h2 className="font-black text-xl mb-2">INCOMPLETE OUTFIT SLOTS</h2>
                    <p className="font-mono text-sm mb-4">We could not assemble a complete outfit from your items. Make sure you have at least one Top, Bottom, and Shoes.</p>
                    <RetroButton onClick={onNavigateToWardrobe}>GO TO WARDROBE</RetroButton>
                </div>
            </RetroWindow>
        );
    }

    const reasoning = suggestedOutfit?.reasoning;
    const currentItemsList = getCurrentItems();
    const swapCandidates = activeSwapCategory
        ? normalizedItems.filter(i => i.category === activeSwapCategory && !currentItemsList.some(c => c.id === i.id))
        : [];

    return (
        <RetroWindow title="OUTFIT_GEN.EXE" className="h-full flex flex-col relative" headerColor="bg-[#FF99C8]">

            {/* Header Status Bar */}
            <div className="flex flex-row justify-between items-center bg-white border-2 border-black p-2 mb-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] gap-2">
                <div className="flex items-center gap-2">
                    <CheckCircle size={16} className={suggestedOutfit?.reasoning ? "text-green-600 fill-green-200" : "text-gray-400"} />
                    <p className={`font-mono text-[10px] md:text-sm font-bold tracking-tight ${suggestedOutfit?.reasoning ? "text-green-700" : "text-gray-500"}`}>
                        {suggestedOutfit?.reasoning ? "MATCHED" : "MANUAL"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <RetroBadge color="bg-[#FF99C8]">
                        {reasoning ? reasoning.styleScore : '---'}%
                    </RetroBadge>
                </div>
            </div>

            {/* Feedback: rate this fit to train future recommendations */}
            {suggestedOutfit && recommendationId && onFeedback && (
                <div className="flex items-center justify-between gap-2 bg-white border-2 border-black p-2 mb-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <span className="font-mono text-[10px] md:text-xs font-bold text-gray-600">
                        {feedback === 'liked' ? 'RATED: LIKED ✓' : feedback === 'disliked' ? 'RATED: NOTED ✓' : 'RATE THIS FIT:'}
                    </span>
                    {!feedback && !showReasons && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => submitFeedback(true)}
                                disabled={feedbackBusy}
                                aria-label="Like this outfit"
                                className="flex items-center gap-1 bg-[#CAFFBF] border-2 border-black px-2 py-1 font-mono text-[10px] md:text-xs font-bold hover:bg-green-300 disabled:opacity-50"
                            >
                                <ThumbsUp size={12} /> LIKE
                            </button>
                            <button
                                onClick={() => setShowReasons(true)}
                                disabled={feedbackBusy}
                                aria-label="Dislike this outfit"
                                className="flex items-center gap-1 bg-[#FF8E72] border-2 border-black px-2 py-1 font-mono text-[10px] md:text-xs font-bold hover:bg-red-400 disabled:opacity-50"
                            >
                                <ThumbsDown size={12} /> DISLIKE
                            </button>
                        </div>
                    )}
                    {!feedback && showReasons && (
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                            {['Too warm', 'Too cold', 'Not my style'].map((reason) => (
                                <button
                                    key={reason}
                                    onClick={() => submitFeedback(false, reason)}
                                    disabled={feedbackBusy}
                                    className="bg-[#FDFFB6] border-2 border-black px-2 py-1 font-mono text-[10px] font-bold hover:bg-yellow-300 disabled:opacity-50"
                                >
                                    {reason.toUpperCase()}
                                </button>
                            ))}
                            <button
                                onClick={() => submitFeedback(false)}
                                disabled={feedbackBusy}
                                className="font-mono text-[10px] underline text-gray-500 hover:text-black disabled:opacity-50"
                            >
                                SKIP
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Main Canvas */}
            <div className="flex-1 bg-[#f0f0f0] border-2 border-black relative p-2 md:p-4 flex items-center justify-center overflow-hidden min-h-[350px] md:min-h-[400px]">

                {isGenerating && (
                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                        <Loader2 size={48} className="animate-spin text-[#FF99C8] mb-4" />
                        <p className="font-mono font-bold text-lg animate-pulse text-center px-4">ANALYZING THERMAL PROPERTIES...</p>
                        <div className="w-48 h-2 border border-white mt-2 overflow-hidden">
                            <div className="h-full bg-[#CAFFBF] animate-[width_1s_ease-in-out_infinite]" style={{ width: `${generationProgress}%` }}></div>
                        </div>
                    </div>
                )}

                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>

                <div className="relative z-10 grid grid-cols-[70px_1fr_80px] md:grid-cols-[120px_1fr_120px] gap-2 md:gap-4 items-center w-full h-full">

                    {/* Left: Accessories */}
                    <div className="relative h-full border-2 border-black/10 bg-black/5 rounded-lg p-1 md:p-2 flex flex-col">
                        <span className="absolute -top-2 md:-top-3 left-1 md:left-2 font-mono text-[8px] md:text-[9px] font-bold bg-[#FDFFB6] border border-black px-1">ACCESSORIES</span>
                        <div className="flex-1 flex flex-col gap-2 md:gap-3 justify-center overflow-y-auto no-scrollbar py-2">
                            {accessories.length > 0 ? accessories.map((acc, _idx) => (
                                <div key={acc.id} className="group relative cursor-pointer transition-transform hover:scale-105 hover:rotate-2 shrink-0 self-center">
                                    <RetroImage
                                        src={acc.image_url}
                                        alt={acc.name}
                                        containerClassName={`w-12 h-12 md:w-20 md:h-20 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${lockedItems.includes(acc.id) ? 'border-red-500' : 'border-black'}`}
                                    />
                                    <button
                                        type="button"
                                        aria-label={lockedItems.includes(acc.id) ? `Unlock ${acc.name}` : `Lock ${acc.name}`}
                                        aria-pressed={lockedItems.includes(acc.id)}
                                        className="absolute top-0 right-0 bg-white border border-black p-1.5 z-20 hover:bg-gray-100 flex items-center justify-center"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleLock?.(acc.id);
                                        }}
                                    >
                                        {lockedItems.includes(acc.id) ? <Lock size={10} className="text-red-500" /> : <Unlock size={10} className="text-gray-400" />}
                                    </button>
                                    <div className="absolute inset-x-0 bottom-0 bg-black/80 text-white text-[8px] font-mono p-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                        {acc.name}
                                    </div>
                                </div>
                            )) : (
                                <div className="w-12 h-12 md:w-16 md:h-16 border-2 border-black border-dashed flex items-center justify-center opacity-20 self-center">
                                    <span className="text-[8px] font-mono text-center">NO ACCS</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Center: Core Items (Tops + Bottom, or a one-piece Dress) */}
                    <div className="flex flex-col gap-2 md:gap-3 items-center justify-center h-full w-full overflow-y-auto no-scrollbar py-2">
                        {coreDress ? (
                            <div
                                className="relative group w-full max-w-[160px] md:max-w-[220px] cursor-pointer transition-transform hover:-translate-y-1"
                                onClick={() => !lockedItems.includes(coreDress.id) && openSwapModal('Dress')}
                            >
                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 font-mono text-[8px] md:text-[9px] font-bold bg-[#A0C4FF] border border-black px-1 shadow-sm">ONE-PIECE</span>
                                <div className={`w-full aspect-[3/4] border-2 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative z-10 ${lockedItems.includes(coreDress.id) ? 'border-red-500' : 'border-black'}`}>
                                    <RetroImage src={coreDress.image_url} alt={coreDress.name || 'Dress'} containerClassName="w-full h-full border-0" />
                                    <button
                                        type="button"
                                        aria-label={lockedItems.includes(coreDress.id) ? `Unlock ${coreDress.name}` : `Lock ${coreDress.name}`}
                                        aria-pressed={lockedItems.includes(coreDress.id)}
                                        className="absolute top-1 left-1 bg-white border border-black p-1.5 z-30 hover:bg-gray-100 flex items-center justify-center"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleLock?.(coreDress.id);
                                        }}
                                    >
                                        {lockedItems.includes(coreDress.id) ? <Lock size={12} className="text-red-500" /> : <Unlock size={12} className="text-gray-400" />}
                                    </button>
                                    <div className="absolute top-1 right-1 bg-[#FDFFB6] border-2 border-black p-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                        <RefreshCcw size={12} />
                                    </div>
                                    <div className="absolute bottom-1 left-1 bg-white/80 backdrop-blur border border-black px-1 text-[9px] font-mono font-bold flex items-center gap-1">
                                        <Thermometer size={8} /> {coreDress.insulation_value}
                                    </div>
                                </div>
                                <div className="bg-black text-white font-mono text-[9px] md:text-[10px] text-center border-2 border-black border-t-0 py-1 truncate px-2 relative z-10">
                                    {coreDress.name}
                                </div>
                            </div>
                        ) : coreBottom ? (
                            <>
                        {/* Tops - Render all for layered looks */}
                        <div className="flex flex-col gap-2 w-full max-w-[160px] md:max-w-[220px]">
                            {coreTops.map((top, index) => (
                                <div
                                    key={top.id}
                                    className="relative group w-full cursor-pointer transition-transform hover:-translate-y-1"
                                    onClick={() => !lockedItems.includes(top.id) && openSwapModal('Top')}
                                >
                                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 font-mono text-[8px] md:text-[9px] font-bold bg-[#A0C4FF] border border-black px-1 shadow-sm">
                                        {coreTops.length > 1 ? `LAYER ${index + 1}` : 'CORE TOP'}
                                    </span>
                                    <div className={`w-full ${index === 0 ? 'aspect-square' : 'aspect-[4/3]'} border-2 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative z-10 ${lockedItems.includes(top.id) ? 'border-red-500' : 'border-black'}`}>
                                        <RetroImage src={top.image_url} alt={top.name || 'Top'} containerClassName="w-full h-full border-0" />

                                        {/* Lock Button */}
                                        <button
                                            type="button"
                                            aria-label={lockedItems.includes(top.id) ? `Unlock ${top.name}` : `Lock ${top.name}`}
                                            aria-pressed={lockedItems.includes(top.id)}
                                            className="absolute top-1 left-1 bg-white border border-black p-1.5 z-30 hover:bg-gray-100 flex items-center justify-center"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleLock?.(top.id);
                                            }}
                                        >
                                            {lockedItems.includes(top.id) ? <Lock size={12} className="text-red-500" /> : <Unlock size={12} className="text-gray-400" />}
                                        </button>

                                        <div className="absolute top-1 right-1 bg-[#FDFFB6] border-2 border-black p-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                            <RefreshCcw size={12} />
                                        </div>
                                        <div className="absolute bottom-1 left-1 bg-white/80 backdrop-blur border border-black px-1 text-[9px] font-mono font-bold flex items-center gap-1">
                                            <Thermometer size={8} /> {top.insulation_value}
                                        </div>
                                    </div>
                                    <div className="bg-black text-white font-mono text-[9px] md:text-[10px] text-center border-2 border-black border-t-0 py-1 truncate px-2 relative z-10">
                                        {top.name}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Bottom */}
                        <div
                            className="relative group w-full max-w-[160px] md:max-w-[220px] cursor-pointer transition-transform hover:-translate-y-1 mt-1 md:mt-2"
                            onClick={() => !lockedItems.includes(coreBottom.id) && openSwapModal('Bottom')}
                        >
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 font-mono text-[8px] md:text-[9px] font-bold bg-[#A0C4FF] border border-black px-1 shadow-sm">CORE BOTTOM</span>
                            <div className={`w-full aspect-[4/5] border-2 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative z-10 ${lockedItems.includes(coreBottom.id) ? 'border-red-500' : 'border-black'}`}>
                                <RetroImage src={coreBottom.image_url} alt={coreBottom.name || 'Bottom'} containerClassName="w-full h-full border-0" />

                                {/* Lock Button */}
                                <button
                                    type="button"
                                    aria-label={lockedItems.includes(coreBottom.id) ? `Unlock ${coreBottom.name}` : `Lock ${coreBottom.name}`}
                                    aria-pressed={lockedItems.includes(coreBottom.id)}
                                    className="absolute top-1 left-1 bg-white border border-black p-1.5 z-30 hover:bg-gray-100 flex items-center justify-center"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleLock?.(coreBottom.id);
                                    }}
                                >
                                    {lockedItems.includes(coreBottom.id) ? <Lock size={12} className="text-red-500" /> : <Unlock size={12} className="text-gray-400" />}
                                </button>

                                <div className="absolute top-1 right-1 bg-[#FDFFB6] border-2 border-black p-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                    <RefreshCcw size={12} />
                                </div>
                                <div className="absolute bottom-1 left-1 bg-white/80 backdrop-blur border border-black px-1 text-[9px] font-mono font-bold flex items-center gap-1">
                                    <Thermometer size={8} /> {coreBottom.insulation_value}
                                </div>
                            </div>
                            <div className="bg-black text-white font-mono text-[9px] md:text-[10px] text-center border-2 border-black border-t-0 py-1 truncate px-2 relative z-10">
                                {coreBottom.name}
                            </div>
                        </div>
                            </>
                        ) : null}
                    </div>

                    {/* Right: Layer & Shoes */}
                    <div className="flex flex-col h-full justify-between py-2 md:py-4 items-end">
                        {/* Outerwear */}
                        <div className="flex flex-col items-end gap-1 relative w-full">
                            <div
                                className="group relative cursor-pointer transition-transform hover:scale-105 hover:-rotate-2 w-full flex flex-col items-end"
                                onClick={() => outerwear && !lockedItems.includes(outerwear.id) && openSwapModal('Outerwear')}
                            >
                                <span className="absolute -top-2 md:-top-3 right-0 font-mono text-[8px] md:text-[9px] font-bold bg-white border border-black px-1 z-20">LAYER</span>
                                {outerwear ? (
                                    <>
                                        <RetroImage
                                            src={outerwear.image_url}
                                            alt={outerwear.name || 'Outerwear'}
                                            containerClassName={`w-16 h-16 md:w-24 md:h-24 bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative z-10 ${lockedItems.includes(outerwear.id) ? 'border-red-500' : 'border-black'}`}
                                        />

                                        {/* Lock Button */}
                                        <button
                                            type="button"
                                            aria-label={lockedItems.includes(outerwear.id) ? `Unlock ${outerwear.name}` : `Lock ${outerwear.name}`}
                                            aria-pressed={lockedItems.includes(outerwear.id)}
                                            className="absolute top-1 left-1 bg-white border border-black p-1 z-30 hover:bg-gray-100 flex items-center justify-center"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleLock?.(outerwear.id);
                                            }}
                                        >
                                            {lockedItems.includes(outerwear.id) ? <Lock size={10} className="text-red-500" /> : <Unlock size={10} className="text-gray-400" />}
                                        </button>

                                        <div className="absolute top-1 right-1 bg-[#FDFFB6] border-2 border-black p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                            <RefreshCcw size={10} />
                                        </div>
                                        <div className="bg-black text-white text-[8px] md:text-[9px] font-mono text-center border-2 border-black border-t-0 w-16 md:w-24 truncate px-1 relative z-10">
                                            {outerwear.name}
                                        </div>
                                    </>
                                ) : (
                                    <div
                                        className="w-16 h-16 md:w-24 md:h-24 border-2 border-black border-dashed flex items-center justify-center opacity-40 bg-white/50 hover:opacity-80 hover:bg-white transition-all cursor-pointer"
                                        onClick={() => openSwapModal('Outerwear')}
                                    >
                                        <span className="text-[8px] font-mono text-center font-bold">+ ADD</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Shoes */}
                        <div
                            className="group relative cursor-pointer transition-transform hover:scale-105 hover:rotate-2 mt-auto w-full flex flex-col items-end"
                            onClick={() => !lockedItems.includes(coreShoes.id) && openSwapModal('Shoes')}
                        >
                            <span className="absolute -top-2 md:-top-3 right-0 font-mono text-[8px] md:text-[9px] font-bold bg-white border border-black px-1 z-20">FOOTWEAR</span>
                            <RetroImage
                                src={coreShoes.image_url}
                                alt={coreShoes.name || 'Shoes'}
                                containerClassName={`w-20 h-20 md:w-28 md:h-28 bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative z-10 ${lockedItems.includes(coreShoes.id) ? 'border-red-500' : 'border-black'}`}
                            />

                                {/* Lock Button */}
                                <button
                                    type="button"
                                    aria-label={lockedItems.includes(coreShoes.id) ? `Unlock ${coreShoes.name}` : `Lock ${coreShoes.name}`}
                                    aria-pressed={lockedItems.includes(coreShoes.id)}
                                    className="absolute top-1 left-1 bg-white border border-black p-1.5 z-30 hover:bg-gray-100 flex items-center justify-center"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleLock?.(coreShoes.id);
                                    }}
                                >
                                    {lockedItems.includes(coreShoes.id) ? <Lock size={12} className="text-red-500" /> : <Unlock size={12} className="text-gray-400" />}
                                </button>

                            <div className="absolute top-1 right-1 bg-[#FDFFB6] border-2 border-black p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                <RefreshCcw size={12} />
                            </div>
                            <div className="bg-black text-white text-[8px] md:text-[9px] font-mono text-center border-2 border-black border-t-0 w-20 md:w-28 truncate px-1 relative z-10">
                                {coreShoes.name}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* AI Reasoning Log */}
            <div className="bg-[#e5e5e5] border-2 border-black mt-2">
                <button
                    onClick={() => setShowReasoning(!showReasoning)}
                    className="w-full flex items-center justify-between p-2 bg-white hover:bg-gray-50"
                >
                    <div className="flex items-center gap-2 font-mono text-xs font-bold">
                        <BrainCircuit size={14} />
                        LOGIC_GATE.LOG
                    </div>
                    {showReasoning ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>

                {showReasoning && (
                    <div className="p-3 font-mono text-[10px] sm:text-xs text-black bg-black/5 space-y-1 border-t-2 border-black [overflow-wrap:anywhere]">
                        {suggestedOutfit ? (
                            <>
                                {suggestedOutfit.reasoning ? (
                                    <>
                                        <div className="flex items-start gap-2">
                                            <span className="text-green-600 font-bold">WEATHER</span>
                                            <span>{reasoning?.weatherMatch}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-pink-600 font-bold">COLOR</span>
                                            <span>{reasoning?.colorAnalysis}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-purple-600 font-bold">SILHOUETTE</span>
                                            <span>{reasoning?.silhouetteBalance || 'Balanced proportions'}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-orange-600 font-bold">LAYERING</span>
                                            <span>{reasoning?.layeringStrategy}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-indigo-600 font-bold">OCCASION</span>
                                            <span>{reasoning?.occasionFit}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-amber-600 font-bold">STATEMENT</span>
                                            <span>{reasoning?.statementPiece || 'N/A'}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-gray-500 italic">Manual configuration active. Logic gate bypassed.</div>
                                )}
                            </>
                        ) : (
                            <div className="text-gray-500 italic">Waiting for outfit generation...</div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Controls */}
            <div className="grid grid-cols-2 gap-2 md:gap-3 mt-2 md:mt-4">
                <RetroButton
                    className="w-full flex items-center justify-center gap-2 py-3 text-xs md:text-base"
                    variant="secondary"
                    onClick={handleLogClick}
                    disabled={isLogging}
                >
                    {isLogging ? (
                        <>
                            <Loader2 size={16} className="animate-spin md:w-[18px] md:h-[18px]" />
                            <span className="hidden md:inline">LOGGING...</span>
                            <span className="md:hidden">LOG...</span>
                        </>
                    ) : (
                        <>
                            <ThumbsUp size={16} className="md:w-[18px] md:h-[18px]" />
                            <span className="hidden md:inline">LOG OUTFIT</span>
                            <span className="md:hidden">LOG OUTFIT</span>
                        </>
                    )}
                </RetroButton>

                <RetroButton
                    className="w-full flex items-center justify-center gap-2 py-3 text-xs md:text-base group relative overflow-hidden"
                    onClick={onGenerate}
                    disabled={isGenerating}
                >
                    <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                    {isGenerating ? (
                        <>
                            <Loader2 size={16} className="animate-spin md:w-[18px] md:h-[18px]" /> GEN...
                        </>
                    ) : (
                        <>
                            <Sparkles size={16} className="md:w-[18px] md:h-[18px]" /> <span className="md:hidden">GENERATE</span><span className="hidden md:inline">GENERATE OUTFIT</span>
                        </>
                    )}
                </RetroButton>
            </div>

            {/* Swap Modal */}
            {isSwapping && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSwapping(false)}></div>
                    <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-200">
                        <RetroWindow
                            title={`SELECT_${activeSwapCategory?.toUpperCase() || 'ITEM'}.DLL`}
                            onClose={() => setIsSwapping(false)}
                            className="bg-[#FFF8E7] max-h-[80vh]"
                        >
                            <div className="sticky top-0 z-10 bg-[#FFF8E7] pb-2 mb-2 border-b-2 border-black border-dashed">
                                <p className="font-mono text-xs text-gray-500 mb-1">Select replacement for {activeSwapCategory}:</p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto p-1 max-h-[400px]">
                                {swapCandidates.map((item) => (
                                    <div
                                        key={item.id}
                                        className="cursor-pointer hover:opacity-80 active:scale-95 transition-transform group"
                                        onClick={() => handleSwapItem(item)}
                                    >
                                        <div className="bg-white border-2 border-black p-1 flex flex-col shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:bg-[#CAFFBF] transition-colors">
                                            <div className="relative aspect-square border border-black mb-1 overflow-hidden">
                                                <RetroImage src={item.image_url} alt={item.name || 'Item'} containerClassName="w-full h-full border-0" />
                                                <div className="absolute top-1 left-1 bg-white/80 backdrop-blur px-1 border border-black text-[8px] font-mono flex items-center gap-0.5">
                                                    <Thermometer size={8} /> {item.insulation_value}
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-mono font-bold truncate">{item.name}</span>
                                            <div className="flex gap-1 mt-1">
                                                <span className="text-[8px] bg-gray-100 border border-black px-1 truncate">{item.material}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {swapCandidates.length === 0 && (
                                    <div className="col-span-full text-center py-8 font-mono text-xs text-gray-500">
                                        NO COMPATIBLE ITEMS FOUND.
                                    </div>
                                )}
                            </div>
                        </RetroWindow>
                    </div>
                </div>
            )}
        </RetroWindow>
    );
};
