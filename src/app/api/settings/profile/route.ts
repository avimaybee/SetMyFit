import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Profile, ApiResponse } from '@/lib/types';

/**
 * GET /api/settings/profile
 * Get user profile settings
 */
export async function GET(_request: NextRequest): Promise<NextResponse<ApiResponse<Profile>>> {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as Profile,
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
 * PUT /api/settings/profile
 * Update user profile settings
 */
export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<Profile>>> {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Build update object
    const updates: Partial<Profile> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.region !== undefined) updates.region = body.region;
    if (body.full_body_model_url !== undefined) updates.full_body_model_url = body.full_body_model_url;
    if (body.preferences !== undefined) updates.preferences = body.preferences;

    // Update profile
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as Profile,
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
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('POST /api/settings/profile - Auth error:', authError?.message);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    console.log('POST /api/settings/profile - User:', user.id);
    console.log('POST /api/settings/profile - Body:', JSON.stringify(body, null, 2));

    // Build the upsert data - only include fields that exist in the table
    const profileData: Record<string, unknown> = {
      id: user.id,
    };

    // Handle name
    if (body.name) {
      profileData.name = body.name;
    }

    // Handle preferences - store in style_preferences column
    if (body.preferences) {
      profileData.style_preferences = body.preferences;
      // Extract gender from preferences if present
      if (body.preferences.gender) {
        profileData.gender = body.preferences.gender;
      }
    }

    // Handle direct gender field
    if (body.gender) {
      profileData.gender = body.gender;
    }

    console.log('POST /api/settings/profile - Upserting:', JSON.stringify(profileData, null, 2));

    // Use upsert to handle both insert and update
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Profile upsert error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log('POST /api/settings/profile - Success:', data?.id);

    return NextResponse.json({
      success: true,
      data: data as Profile,
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

