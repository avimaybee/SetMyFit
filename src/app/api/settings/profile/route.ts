import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbFirst, mapProfile, nowIso, toJson } from '@/lib/db';
import { Profile, ApiResponse } from '@/lib/types';

/**
 * GET /api/settings/profile
 * Get user profile settings
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Profile>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const row = await dbFirst('SELECT * FROM profiles WHERE id = ?', [user.uid]);
    if (!row) {
      return NextResponse.json({
        success: true,
        data: null,
        hasProfile: false,
        message: 'No profile configured yet',
      } as unknown as ApiResponse<Profile>, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      data: mapProfile(row) as unknown as Profile,
      hasProfile: true,
    } as unknown as ApiResponse<Profile>);
  } catch (error) {
    console.warn('Error checking profile:', error);
    return NextResponse.json({
      success: true,
      data: null,
      hasProfile: false,
      message: 'Profile check fallback',
    } as unknown as ApiResponse<Profile>, { status: 200 });
  }
}

/**
 * PUT /api/settings/profile
 * Update user profile settings
 */
export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<Profile>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    // Parse request body
    const body = await request.json();

    const sets: string[] = [];
    const params: Array<string | number | null> = [];
    if (body.name !== undefined) { sets.push('name = ?'); params.push(body.name ?? null); }
    if (body.region !== undefined) { sets.push('region = ?'); params.push(body.region ?? null); }
    if (body.full_body_model_url !== undefined) { sets.push('full_body_model_url = ?'); params.push(body.full_body_model_url ?? null); }
    if (body.preferences !== undefined) { sets.push('preferences = ?'); params.push(toJson(body.preferences)); }
    sets.push('updated_at = ?');
    params.push(nowIso());

    const row = await dbFirst(
      `UPDATE profiles SET ${sets.join(', ')} WHERE id = ? RETURNING *`,
      [...params, user.uid]
    );

    if (!row) {
      const inserted = await dbFirst(
        `INSERT INTO profiles (id, name, region, full_body_model_url, preferences, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        [user.uid, body.name ?? null, body.region ?? null, body.full_body_model_url ?? null, toJson(body.preferences || {}), nowIso(), nowIso()]
      );
      return NextResponse.json({
        success: true,
        data: (inserted ? mapProfile(inserted) : null) as unknown as Profile,
        message: 'Profile created successfully',
      });
    }

    return NextResponse.json({
      success: true,
      data: mapProfile(row) as unknown as Profile,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/profile
 * Create or update user profile (used during onboarding)
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Profile>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    // Parse request body
    const body = await request.json();

    const existing = await dbFirst('SELECT id FROM profiles WHERE id = ?', [user.uid]);

    let name: string | null = null;
    let stylePreferences: string | null = null;
    let gender: string | null = null;

    if (body.name) name = body.name;
    if (body.preferences) {
      stylePreferences = JSON.stringify(body.preferences);
      if (body.preferences.gender) gender = body.preferences.gender;
    }
    if (body.gender) gender = body.gender;

    let row;
    if (existing) {
      row = await dbFirst(
        `UPDATE profiles SET
           name = COALESCE(?, name),
           style_preferences = COALESCE(?, style_preferences),
           gender = COALESCE(?, gender),
           updated_at = ?
         WHERE id = ? RETURNING *`,
        [name, stylePreferences, gender, nowIso(), user.uid]
      );
    } else {
      row = await dbFirst(
        `INSERT INTO profiles (id, name, style_preferences, gender, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
        [user.uid, name, stylePreferences, gender, nowIso(), nowIso()]
      );
    }

    if (!row) {
      return NextResponse.json({ success: false, error: 'Failed to save profile' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: mapProfile(row) as unknown as Profile,
      message: 'Profile saved successfully',
    });
  } catch (error) {
    console.error('POST /api/settings/profile error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
