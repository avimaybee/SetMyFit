import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';
import { RetroWindow, RetroBox } from '@/components/retro-ui';
import { Award, TrendingUp, Activity, Shirt, Palette, Calendar, AlertTriangle } from 'lucide-react';
import { ClothingItem, Outfit } from '@/types/retro';

interface StatsPageProps {
    items: ClothingItem[];
    _history?: Outfit[];
}

// We will use CSS variables for colors so they switch with theme
const CHART_COLORS = [
    'var(--accent-pink)',
    'var(--accent-blue)',
    'var(--accent-green)',
    'var(--accent-yellow)',
    'var(--accent-orange)'
];

export const StatsPage: React.FC<StatsPageProps> = ({ items, _history }) => {

    // Calculate Analytics on the fly
    const analytics = useMemo(() => {
        const totalItems = items.length;
        const favoriteCount = items.filter(i => i.is_favorite).length;
        const totalWearCount = items.reduce((sum, i) => sum + (i.wear_count || 0), 0);
        const avgWearCount = totalItems > 0 ? (totalWearCount / totalItems).toFixed(1) : '0';
        const maxWearItem = [...items].sort((a, b) => (b.wear_count || 0) - (a.wear_count || 0))[0];

        // Rarely worn: wear_count < 2
        const rarelyWornCount = items.filter(i => (i.wear_count || 0) < 2).length;

        // Never worn: wear_count === 0
        const neverWornCount = items.filter(i => (i.wear_count || 0) === 0).length;

        // Items not worn in 30+ days
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const neglectedItems = items.filter(i => {
            if (!i.last_worn) return true;
            return new Date(i.last_worn) < thirtyDaysAgo;
        }).length;

        // Category breakdown for chart
        const catCounts: Record<string, number> = {};
        items.forEach(i => {
            const cat = i.category || 'Unknown';
            catCounts[cat] = (catCounts[cat] || 0) + 1;
        });
        const chartData = Object.entries(catCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        // Color breakdown
        const colorCounts: Record<string, number> = {};
        items.forEach(i => {
            const color = i.color || 'Unknown';
            colorCounts[color] = (colorCounts[color] || 0) + 1;
        });
        const topColors = Object.entries(colorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Material breakdown
        const materialCounts: Record<string, number> = {};
        items.forEach(i => {
            const mat = i.material || 'Unknown';
            materialCounts[mat] = (materialCounts[mat] || 0) + 1;
        });
        const topMaterials = Object.entries(materialCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        // Outfits logged
        const outfitsLogged = _history?.length || 0;

        // Last outfit date
        const lastOutfitDate = _history && _history.length > 0
            ? new Date(_history[0].outfit_date).toLocaleDateString()
            : 'Never';

        return {
            totalItems,
            favoriteCount,
            avgWearCount,
            maxWearItem,
            rarelyWornCount,
            neverWornCount,
            neglectedItems,
            chartData,
            topColors,
            topMaterials,
            outfitsLogged,
            lastOutfitDate
        };
    }, [items, _history]);

    // Empty state
    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="w-20 h-20 bg-[var(--accent-yellow)] border-4 border-[var(--border)] rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_var(--border)]">
                    <Activity size={40} className="text-[var(--text)]" />
                </div>
                <h2 className="font-black text-2xl text-center text-[var(--text)]">NO DATA YET</h2>
                <p className="font-mono text-sm text-[var(--text-muted)] text-center max-w-xs">
                    Add items to your wardrobe and log some outfits to see your statistics here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <RetroBox color="bg-[var(--accent-blue)]" className="flex flex-col justify-between text-[var(--text)]">
                    <div className="flex justify-between items-start">
                        <Shirt size={20} />
                        <span className="font-mono text-[10px] font-bold">WARDROBE</span>
                    </div>
                    <p className="font-black text-3xl mt-2">{analytics.totalItems}</p>
                    <p className="text-[10px] font-mono opacity-80">Total Items</p>
                </RetroBox>

                <RetroBox color="bg-[var(--accent-green)]" className="flex flex-col justify-between text-[var(--text)]">
                    <div className="flex justify-between items-start">
                        <Calendar size={20} />
                        <span className="font-mono text-[10px] font-bold">LOGGED</span>
                    </div>
                    <p className="font-black text-3xl mt-2">{analytics.outfitsLogged}</p>
                    <p className="text-[10px] font-mono opacity-80">Outfits</p>
                </RetroBox>

                <RetroBox color="bg-[var(--accent-pink)]" className="flex flex-col justify-between text-[var(--text)]">
                    <div className="flex justify-between items-start">
                        <Activity size={20} />
                        <span className="font-mono text-[10px] font-bold">AVG WEAR</span>
                    </div>
                    <p className="font-black text-3xl mt-2">{analytics.avgWearCount}</p>
                    <p className="text-[10px] font-mono opacity-80">Per Item</p>
                </RetroBox>

                <RetroBox color="bg-[var(--accent-orange)]" className="flex flex-col justify-between text-[var(--text)]">
                    <div className="flex justify-between items-start">
                        <AlertTriangle size={20} />
                        <span className="font-mono text-[10px] font-bold">NEGLECTED</span>
                    </div>
                    <p className="font-black text-3xl mt-2">{analytics.neglectedItems}</p>
                    <p className="text-[10px] font-mono opacity-80">30+ days</p>
                </RetroBox>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category Distribution */}
                <RetroWindow title="CATEGORY_BREAKDOWN" className="min-h-[300px]">
                    <div className="p-4 flex flex-col gap-2 h-full">
                        <div className="h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.chartData} layout="vertical">
                                    <XAxis
                                        type="number"
                                        tick={{ fill: 'var(--text)', fontFamily: 'monospace', fontSize: 10 }}
                                        axisLine={{ stroke: 'var(--border)', strokeWidth: 2 }}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--bg-secondary)',
                                            border: '2px solid var(--border)',
                                            fontFamily: 'monospace',
                                            color: 'var(--text)'
                                        }}
                                    />
                                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                        {analytics.chartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="var(--border)" strokeWidth={2} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </RetroWindow>

                {/* Color Palette */}
                <RetroWindow title="COLOR_PALETTE" icon={<Palette size={14} />}>
                    <div className="p-4 space-y-3">
                        <p className="font-mono text-xs text-[var(--text-muted)] mb-2">Your most common colors</p>
                        {analytics.topColors.map(([color, count], idx) => (
                            <div key={color} className="flex items-center gap-3">
                                <div
                                    className="w-8 h-8 border-2 border-[var(--border)] shadow-[2px_2px_0px_0px_var(--border)]"
                                    style={{
                                        backgroundColor: color.toLowerCase() === 'unknown' ? '#ccc' : color.toLowerCase()
                                    }}
                                />
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <span className="font-mono text-sm font-bold text-[var(--text)]">{color}</span>
                                        <span className="font-mono text-xs text-[var(--text-muted)]">{count} items</span>
                                    </div>
                                    <div className="h-2 bg-[var(--bg-tertiary)] border border-[var(--border)] mt-1">
                                        <div
                                            className="h-full transition-all"
                                            style={{
                                                width: `${(count / analytics.totalItems) * 100}%`,
                                                backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {analytics.topColors.length === 0 && (
                            <p className="text-center text-[var(--text-muted)] font-mono text-sm py-4">No color data available</p>
                        )}
                    </div>
                </RetroWindow>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* MVP Item */}
                <RetroBox color="bg-[var(--accent-yellow)]" className="flex items-center gap-4">
                    <div className="p-3 bg-[var(--bg-secondary)] border-2 border-[var(--border)] rounded-full shadow-[2px_2px_0px_0px_var(--border)]">
                        <Award size={32} className="text-[var(--text)]" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-mono text-xs uppercase font-bold text-[var(--text-muted)]">MVP Item</h3>
                        <p className="font-black text-lg tracking-tight text-[var(--text)] truncate">
                            {analytics.maxWearItem?.name || "N/A"}
                        </p>
                        <p className="text-xs font-mono font-bold text-[var(--text)] bg-[var(--bg-secondary)] px-1 inline-block border border-[var(--border)] mt-1">
                            Worn {analytics.maxWearItem?.wear_count || 0}x
                        </p>
                    </div>
                </RetroBox>

                {/* Quick Stats */}
                <RetroWindow title="QUICK_STATS">
                    <div className="space-y-2 font-mono text-sm p-3 text-[var(--text)]">
                        <div className="flex justify-between items-center border-b border-[var(--border)] border-dashed pb-1">
                            <span className="text-[var(--text-muted)]">Favorites:</span>
                            <span className="font-bold text-red-500">{analytics.favoriteCount} ♥</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[var(--border)] border-dashed pb-1">
                            <span className="text-[var(--text-muted)]">Never Worn:</span>
                            <span className="font-bold">{analytics.neverWornCount}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[var(--border)] border-dashed pb-1">
                            <span className="text-[var(--text-muted)]">Rarely Worn:</span>
                            <span className="font-bold">{analytics.rarelyWornCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[var(--text-muted)]">Last Outfit:</span>
                            <span className="font-bold">{analytics.lastOutfitDate}</span>
                        </div>
                    </div>
                </RetroWindow>

                {/* Materials */}
                <RetroWindow title="TOP_MATERIALS">
                    <div className="p-3 space-y-2">
                        {analytics.topMaterials.map(([material, count], idx) => (
                            <div key={material} className="flex justify-between items-center font-mono text-sm">
                                <span className="text-[var(--text)]">
                                    <span className="inline-block w-3 h-3 mr-2 border border-[var(--border)]" style={{ backgroundColor: CHART_COLORS[idx] }} />
                                    {material}
                                </span>
                                <span className="text-[var(--text-muted)]">{count}</span>
                            </div>
                        ))}
                        {analytics.topMaterials.length === 0 && (
                            <p className="text-center text-[var(--text-muted)] font-mono text-xs py-2">No material data</p>
                        )}
                    </div>
                </RetroWindow>
            </div>
        </div>
    );
};
