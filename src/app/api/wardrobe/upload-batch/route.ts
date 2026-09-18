import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { boolInt, dbFirst, nowIso, toJson } from '@/lib/db';
import { buildR2Key, getR2PublicUrl, isR2Configured, r2Put } from '@/lib/r2';
import { logger } from '@/lib/logger';
import { analyzeClothingImage } from '@/lib/helpers/aiOutfitAnalyzer';

/**
 * POST /api/wardrobe/upload-batch
 *
 * Batch upload wardrobe items from onboarding.
 * Accepts multipart form data with files and metadata.
 * Analyzes each image with AI to extract colors, type, and characteristics.
 * Uploads images to R2 and creates clothing items in D1.
 */

interface UploadedItemMetadata {
  name?: string;
  type?: string;
  color?: string;
  material?: string;
  style_tags?: string[];
  dress_code?: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const hasR2 = await isR2Configured();

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided', message: 'At least one file is required' },
        { status: 400 }
      );
    }

    if (files.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Too many files', message: 'Maximum 50 items per batch' },
        { status: 400 }
      );
    }

    logger.info('Processing batch wardrobe upload', {
      userId: user.uid,
      fileCount: files.length,
    });

    // Process each file
    const createdItems = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];

        // Validate file type
        if (!file.type.startsWith('image/')) {
          errors.push({ index: i, error: 'File must be an image' });
          continue;
        }

        // Get metadata if provided
        const metadataJson = formData.get(`metadata_${i}`) as string | null;
        let metadata: UploadedItemMetadata = {};

        if (metadataJson) {
          try {
            metadata = JSON.parse(metadataJson) as UploadedItemMetadata;
          } catch {
            logger.warn(`Failed to parse metadata for file ${i}`);
          }
        }

        // Convert file to base64 for analysis
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        // Analyze image with AI
        let analysisResult = {
          detectedType: metadata.type || 'accessory',
          detectedColor: metadata.color || '#808080',
          detectedMaterial: metadata.material || 'unknown',
          detectedStyleTags: metadata.style_tags || [],
        };

        try {
          analysisResult = await analyzeClothingImage(base64, file.type);
        } catch (analysisError) {
          logger.warn('Image analysis failed, using defaults', {
            error: analysisError instanceof Error ? analysisError.message : String(analysisError),
            index: i,
          });
          // Continue with defaults extracted from metadata or hardcoded
        }

        // Upload image to R2 (or fallback to data URL)
        let imageUrl: string;
        if (hasR2) {
          const key = buildR2Key(user.uid, file.type || 'image/jpeg');
          await r2Put(key, Buffer.from(arrayBuffer), file.type || 'image/jpeg');
          imageUrl = await getR2PublicUrl(key);
        } else {
          imageUrl = `data:${file.type || 'image/jpeg'};base64,${base64}`;
        }

        // Create clothing item in database
        const itemName = metadata.name || file.name.replace(/\.[^/.]+$/, '');

        const createdItem = await dbFirst(
          `INSERT INTO clothing_items
            (user_id, name, image_url, type, color, material, style_tags,
             pattern, fit, dress_code, insulation_value, last_worn, created_at, is_favorite)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING *`,
          [
            user.uid,
            itemName,
            imageUrl,
            analysisResult.detectedType,
            analysisResult.detectedColor,
            analysisResult.detectedMaterial,
            toJson(analysisResult.detectedStyleTags),
            'solid',
            'regular',
            toJson(['casual']),
            5,
            null,
            nowIso(),
            boolInt(false),
          ]
        );

        if (createdItem) {
          createdItems.push(createdItem);
          logger.info('Clothing item created', {
            userId: user.uid,
            itemId: createdItem.id,
            itemName,
          });
        }
      } catch (itemError) {
        const errorMsg = itemError instanceof Error ? itemError.message : String(itemError);
        logger.error('Error processing file', {
          index: i,
          error: errorMsg,
        });
        errors.push({ index: i, error: errorMsg });
      }
    }

    // Return results
    return NextResponse.json(
      {
        success: true,
        itemsCreated: createdItems.length,
        items: createdItems,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully created ${createdItems.length} wardrobe item${createdItems.length !== 1 ? 's' : ''}${
          errors.length > 0 ? ` (${errors.length} failed)` : ''
        }`,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Error in wardrobe upload-batch:', { error: errorMsg });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: errorMsg,
      },
      { status: 500 }
    );
  }
}
