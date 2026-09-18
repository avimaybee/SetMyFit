import { NextResponse } from 'next/server';
import { dbAll, parseJson } from '@/lib/db';

const FALLBACK_TEMPLATES = [
  { id: 't1', name: 'Office Core', description: 'Smart casual office outfit', style_tags: '["business-casual","minimal"]', requirements: '["Top","Bottom","Footwear"]' },
  { id: 't2', name: 'Weekend Warrior', description: 'Relaxed weekend outfit', style_tags: '["casual","streetwear"]', requirements: '["Top","Bottom","Footwear"]' },
  { id: 't3', name: 'Date Night', description: 'Polished evening outfit', style_tags: '["smart","evening"]', requirements: '["Top","Bottom","Footwear"]' },
  { id: 't4', name: 'Rain Defense', description: 'Weather-ready layered outfit', style_tags: '["functional","layered"]', requirements: '["Outerwear","Top","Bottom","Footwear"]' },
];

export async function GET() {
  try {
    const rows = await dbAll('SELECT * FROM outfit_templates ORDER BY name', []);
    const sourceRows = rows.length > 0 ? rows : FALLBACK_TEMPLATES;
    const data = sourceRows.map((row) => ({
      ...row,
      style_tags: parseJson<string[] | null>(row.style_tags, null),
      requirements: parseJson<string[] | null>(row.requirements, null),
    }));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching templates, returning blueprints:', error);
    const data = FALLBACK_TEMPLATES.map((row) => ({
      ...row,
      style_tags: parseJson<string[] | null>(row.style_tags, null),
      requirements: parseJson<string[] | null>(row.requirements, null),
    }));
    return NextResponse.json({ success: true, data });
  }
}
