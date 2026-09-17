import { NextResponse } from 'next/server';
import { dbAll, parseJson } from '@/lib/db';

export async function GET() {
  try {
    const rows = await dbAll('SELECT * FROM outfit_templates ORDER BY name', []);
    const data = rows.map((row) => ({
      ...row,
      style_tags: parseJson<string[] | null>(row.style_tags, null),
      requirements: parseJson<string[] | null>(row.requirements, null),
    }));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
