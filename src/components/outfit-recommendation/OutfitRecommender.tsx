import React, { useState, useMemo } from 'react';
import { RefreshCcw, ThumbsUp, CheckCircle, Sparkles, Loader2, BrainCircuit, ChevronDown, ChevronUp, Thermometer, Lock, Unlock } from 'lucide-react';
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
}

interface OrganizedOutfit {
    coreTop?: ClothingItem;
    coreBottom?: ClothingItem;
    coreShoes?: ClothingItem;
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
    isLogging = false
}) => {
    const [isSwapping, setIsSwapping] = useState(false);
    const [activeSwapCategory, setActiveSwapCategory] = useState<ClothingType | null>(null);
    const [showReasoning, setShowReasoning] = useState(true);

    const displaySet: OrganizedOutfit = useMemo(() => {
        const set: OrganizedOutfit = { accessories: [] };

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

        const sourceItems = suggestedOutfit ? suggestedOutfit.items.map(normalizeCategory) : items.map(normalizeCategory);

        const extract = (cat: ClothingType) => {
            const idx = sourceItems.findIndex(i => i.category === cat);
            if (idx !== -1) {
                const [item] = sourceItems.splice(idx, 1);
                return item;
            }
            return undefined;
        };

        // Priority extraction based on category
        set.coreTop = extract('Top');
        set.coreBottom = extract('Bottom');
        set.coreShoes = extract('Shoes');
        set.outerwear = extract('Outerwear');

        // Anything left with category 'Accessory' goes to accessories
        set.accessories = sourceItems.filter(i => i.category === 'Accessory');

        // Fallback for empty state (Home Screen initial) OR partial outfit - search normalized incoming items
        if (items.length > 0 && (!set.coreTop || !set.coreBottom || !set.coreShoes)) {
            const normalized = items.map(normalizeCategory);
            if (!set.coreTop) set.coreTop = normalized.find(i => i.category === 'Top');
            if (!set.coreBottom) set.coreBottom = normalized.find(i => i.category === 'Bottom');
            if (!set.coreShoes) set.coreShoes = normalized.find(i => i.category === 'Shoes');
        }

        return set;
    }, [suggestedOutfit, items]);

    const getCurrentItems = () => {
        const list: ClothingItem[] = [];
        if (displaySet.coreTop) list.push(displaySet.coreTop);
        if (displaySet.coreBottom) list.push(displaySet.coreBottom);
        if (displaySet.coreShoes) list.push(displaySet.coreShoes);
        if (displaySet.outerwear) list.push(displaySet.outerwear);
        if (displaySet.accessories) list.push(...displaySet.accessories);
        return list;
    };

    const handleLogClick = () => {
        if (isLogging) {
            return;
        }
        const itemsToLog = getCurrentItems();
        if (itemsToLog.length > 0) {
            onLogOutfit(itemsToLog);
        }
    };

    const openSwapModal = (category: ClothingType) => {
        setActiveSwapCategory(category);
        setIsSwapping(true);
    };

    const handleSwapItem = (newItem: ClothingItem) => {
        const currentItems = getCurrentItems();
        // Remove the item that occupies the current slot (if any)
        // For simple slots (Top, Bottom, Shoes, Outerwear), we filter out the old one of that category
        const filtered = currentItems.filter(i => i.category !== activeSwapCategory);

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

    if (coreCategoriesPresent.size < 3) {
        return (
            <RetroWindow title="OUTFIT_GEN.EXE" className="h-full flex items-center justify-center text-center p-6">
                <div>
                    <h2 className="font-black text-xl mb-2">NOT ENOUGH CORE ITEMS</h2>
                    <p className="font-mono text-sm mb-4">Your wardrobe needs at least one Top, one Bottom, and one pair of Shoes to generate outfits. Found: {Array.from(coreCategoriesPresent).join(', ') || 'none'}.</p>
                    <RetroButton>GO TO WARDROBE</RetroButton>
                </div>
            </RetroWindow>
        );
    }

    const { coreTop, coreBottom, coreShoes, outerwear, accessories } = displaySet;

    // If a core slot is missing after all fallback attempts, show helpful message instead of rendering nothing
    if (!coreTop || !coreBottom || !coreShoes) {
        return (
            <RetroWindow title="OUTFIT_GEN.EXE" className="h-full flex items-center justify-center text-center p-6">
                <div>
                    <h2 className="font-black text-xl mb-2">INCOMPLETE OUTFIT SLOTS</h2>
                    <p className="font-mono text-sm mb-4">We could not assemble a complete outfit from your items. Make sure you have at least one Top, Bottom, and Shoes.</p>
                    <RetroButton>GO TO WARDROBE</RetroButton>
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
                        {suggestedOutfit?.reasoning ? "AI OPTIMIZED" : "MANUAL EDIT"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <RetroBadge color="bg-[#FF99C8]">
                        {reasoning ? reasoning.styleScore : '---'}%
                    </RetroBadge>
                </div>
            </div>

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
                                    <div
                                        className="absolute top-0 right-0 bg-white border border-black p-0.5 z-20 hover:bg-gray-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleLock?.(acc.id);
                                        }}
                                    >
                                        {lockedItems.includes(acc.id) ? <Lock size={10} className="text-red-500" /> : <Unlock size={10} className="text-gray-400" />}
                                    </div>
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

                    {/* Center: Core Items */}
                    <div className="flex flex-col gap-2 md:gap-3 items-center justify-center h-full w-full">
                        {/* Top */}
                        <div
                            className="relative group w-full max-w-[160px] md:max-w-[220px] cursor-pointer transition-transform hover:-translate-y-1"
                            onClick={() => !lockedItems.includes(coreTop.id) && openSwapModal('Top')}
                        >
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 font-mono text-[8px] md:text-[9px] font-bold bg-[#A0C4FF] border border-black px-1 shadow-sm">CORE TOP</span>
                            <div className={`w-full aspect-square border-2 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative z-10 ${lockedItems.includes(coreTop.id) ? 'border-red-500' : 'border-black'}`}>
                                <RetroImage src={coreTop.image_url} alt={coreTop.name || 'Top'} containerClassName="w-full h-full border-0" />

                                {/* Lock Button */}
                                <div
                                    className="absolute top-1 left-1 bg-white border border-black p-1 z-30 hover:bg-gray-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleLock?.(coreTop.id);
                                    }}
                                >
                                    {lockedItems.includes(coreTop.id) ? <Lock size={12} className="text-red-500" /> : <Unlock size={12} className="text-gray-400" />}
                                </div>

                                <div className="absolute top-1 right-1 bg-[#FDFFB6] border-2 border-black p-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                    <RefreshCcw size={12} />
                                </div>
                                <div className="absolute bottom-1 left-1 bg-white/80 backdrop-blur border border-black px-1 text-[9px] font-mono font-bold flex items-center gap-1">
                                    <Thermometer size={8} /> {coreTop.insulation_value}
                                </div>
                            </div>
                            <div className="bg-black text-white font-mono text-[9px] md:text-[10px] text-center border-2 border-black border-t-0 py-1 truncate px-2 relative z-10">
                                {coreTop.name}
                            </div>
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
                                <div
                                    className="absolute top-1 left-1 bg-white border border-black p-1 z-30 hover:bg-gray-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleLock?.(coreBottom.id);
                                    }}
                                >
                                    {lockedItems.includes(coreBottom.id) ? <Lock size={12} className="text-red-500" /> : <Unlock size={12} className="text-gray-400" />}
                                </div>

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
                                        <div
                                            className="absolute top-1 left-1 bg-white border border-black p-0.5 z-30 hover:bg-gray-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleLock?.(outerwear.id);
                                            }}
                                        >
                                            {lockedItems.includes(outerwear.id) ? <Lock size={10} className="text-red-500" /> : <Unlock size={10} className="text-gray-400" />}
                                        </div>

                                        <div className="absolute top-1 right-1 bg-[#FDFFB6] border-2 border-black p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                            <RefreshCcw size={10} />
                                        </div>
                                        <div className="bg-black text-white text-[8px] md:text-[9px] font-mono text-center border-2 border-black border-t-0 w-16 md:w-24 truncate px-1 relative z-10">
                                            {outerwear.name}
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-16 h-16 md:w-24 md:h-24 border-2 border-black border-dashed flex items-center justify-center opacity-20 bg-white/50 hover:opacity-50 hover:bg-white transition-all">
                                        <span className="text-[8px] font-mono text-center">+ ADD</span>
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
                                alt="Shoes"
                                containerClassName={`w-20 h-20 md:w-28 md:h-28 bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative z-10 ${lockedItems.includes(coreShoes.id) ? 'border-red-500' : 'border-black'}`}
                            />

                            {/* Lock Button */}
                            <div
                                className="absolute top-1 left-1 bg-white border border-black p-1 z-30 hover:bg-gray-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleLock?.(coreShoes.id);
                                }}
                            >
                                {lockedItems.includes(coreShoes.id) ? <Lock size={12} className="text-red-500" /> : <Unlock size={12} className="text-gray-400" />}
                            </div>

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
                    <div className="p-3 font-mono text-[10px] sm:text-xs text-black bg-black/5 space-y-1 border-t-2 border-black">
                        {suggestedOutfit ? (
                            <>
                                {suggestedOutfit.reasoning ? (
                                    <>
                                        <div className="flex items-start gap-2">
                                            <span className="text-green-600 font-bold">WEATHER</span>
                                            <span>{reasoning?.weatherMatch}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-purple-600 font-bold">THERMAL</span>
                                            <span>Total Insulation: {reasoning?.totalInsulation}/10</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-pink-600 font-bold">COLOR</span>
                                            <span>{reasoning?.colorAnalysis}</span>
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
                                            <span className="text-blue-600 font-bold">HISTORY</span>
                                            <span>{reasoning?.historyCheck}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-gray-500 italic">Manual configuration active. Logic gate bypassed.</div>
                                )}
                            </>
                        ) : (
                            <div className="text-gray-500 italic">Waiting for AI generation sequence...</div>
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
                            <span className="md:hidden">LOG FIT</span>
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
                            <Sparkles size={16} className="md:w-[18px] md:h-[18px]" /> <span className="md:hidden">GENERATE</span><span className="hidden md:inline">GENERATE FIT</span>
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
