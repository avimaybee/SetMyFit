import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';
import { RetroWindow, RetroBox } from '@/components/retro-ui';
import { Award, TrendingUp, Activity } from 'lucide-react';
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
  
  // Calculate Analytics on the fly (simulating wardrobe_analytics view)
  const analytics = useMemo(() => {
      const totalItems = items.length;
      const favoriteCount = items.filter(i => i.is_favorite).length;
      const totalWearCount = items.reduce((sum, i) => sum + i.wear_count, 0);
      const avgWearCount = totalItems > 0 ? (totalWearCount / totalItems).toFixed(1) : 0;
      const maxWearItem = [...items].sort((a,b) => b.wear_count - a.wear_count)[0];
      
      // Logic for "Rarely Worn": wear_count < 2 OR not worn in 90 days (mocked by simple wear count here)
      const rarelyWornCount = items.filter(i => i.wear_count < 2).length;

      // Category breakdown for chart
      const catCounts: Record<string, number> = {};
      items.forEach(i => {
          catCounts[i.category] = (catCounts[i.category] || 0) + 1;
      });
      const chartData = Object.keys(catCounts).map(k => ({ name: k, count: catCounts[k] }));

      return {
          totalItems,
          favoriteCount,
          avgWearCount,
          maxWearItem,
          rarelyWornCount,
          chartData
      };
  }, [items]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <RetroWindow title="WARDROBE_ANALYTICS.VIEW" className="min-h-[300px]">
        <div className="p-4 flex flex-col gap-2 h-full">
             <h3 className="font-mono font-bold uppercase border-b-2 border-[var(--border)] pb-1 text-[var(--text)]">Inventory Distribution</h3>
             <div className="h-64 w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.chartData}>
                    <XAxis 
                        dataKey="name" 
                        tick={{fill: 'var(--text)', fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold'}} 
                        axisLine={{stroke: 'var(--border)', strokeWidth: 2}}
                        tickLine={false}
                        dy={10}
                    />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: 'var(--bg-secondary)', 
                            border: '2px solid var(--border)', 
                            boxShadow: '4px 4px 0px 0px var(--border)',
                            fontFamily: 'monospace',
                            color: 'var(--text)'
                        }} 
                        itemStyle={{ color: 'var(--text)' }}
                        labelStyle={{ color: 'var(--text)', fontWeight: 'bold', borderBottom: '1px dashed var(--border)', marginBottom: '4px' }}
                        cursor={{fill: 'var(--bg-tertiary)'}}
                    />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                        {analytics.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="var(--border)" strokeWidth={2} />
                        ))}
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </RetroWindow>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
            <RetroBox color="bg-[var(--accent-green)]" className="flex flex-col justify-between text-[var(--text)]">
                <div className="flex justify-between items-start">
                    <Activity size={24} />
                    <span className="font-mono text-xs font-bold">AVG WEAR</span>
                </div>
                <p className="font-black text-4xl mt-2">{analytics.avgWearCount}</p>
                <p className="text-[10px] font-mono opacity-80">Per Item</p>
            </RetroBox>
            
            <RetroBox color="bg-[var(--accent-orange)]" className="flex flex-col justify-between text-[var(--text)]">
                <div className="flex justify-between items-start">
                    <TrendingUp size={24} />
                    <span className="font-mono text-xs font-bold">RARELY WORN</span>
                </div>
                <p className="font-black text-4xl mt-2">{analytics.rarelyWornCount}</p>
                <p className="text-[10px] font-mono opacity-80">Items to purge?</p>
            </RetroBox>
        </div>

        <RetroBox color="bg-[var(--accent-blue)]" className="flex items-center gap-4">
            <div className="p-3 bg-[var(--bg-secondary)] border-2 border-[var(--border)] rounded-full shadow-[2px_2px_0px_0px_var(--border)]">
                <Award size={32} className="text-[var(--text)]" />
            </div>
            <div>
                <h3 className="font-mono text-sm uppercase font-bold text-[var(--text)]">MVP Item</h3>
                <p className="font-black text-xl tracking-tight text-[var(--text)]">{analytics.maxWearItem?.name || "N/A"}</p>
                <p className="text-xs font-mono font-bold text-[var(--text)] bg-[var(--bg-secondary)] px-1 inline-block border border-[var(--border)] mt-1">Worn {analytics.maxWearItem?.wear_count || 0} times</p>
            </div>
        </RetroBox>

        <RetroWindow title="SYSTEM_STATS.LOG">
            <div className="space-y-2 font-mono text-sm p-2 text-[var(--text)]">
                <div className="flex justify-between items-center border-b border-[var(--border)] border-dashed pb-1">
                    <span className="text-[var(--text-muted)]">Total Assets:</span>
                    <span className="font-bold">{analytics.totalItems} Items</span>
                </div>
                <div className="flex justify-between items-center border-b border-[var(--border)] border-dashed pb-1">
                    <span className="text-[var(--text-muted)]">Favorites:</span>
                    <span className="font-bold text-red-500">{analytics.favoriteCount} ♥</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[var(--text-muted)]">Database Size:</span>
                    <span className="font-bold">{JSON.stringify(items).length / 1024} KB</span>
                </div>
            </div>
        </RetroWindow>
      </div>
    </div>
  );
};
