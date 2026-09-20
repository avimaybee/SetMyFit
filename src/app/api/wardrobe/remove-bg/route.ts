import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { parseDataUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { image } = body;

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Valid image base64 data is required' },
        { status: 400 }
      );
    }

    const { base64: rawBase64, mimeType } = parseDataUrl(image, 'image/jpeg');
    const imageBuffer = Buffer.from(rawBase64, 'base64');

    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    const removeBgKey = process.env.REMOVE_BG_API_KEY;

    // 1. Primary: Hugging Face RMBG-1.4 Serverless Inference
    if (hfToken) {
      try {
        const hfRes = await fetch('https://router.huggingface.co/hf-inference/models/briaai/RMBG-1.4', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': mimeType || 'image/jpeg',
          },
          body: imageBuffer,
          signal: AbortSignal.timeout(15000),
        });

        if (hfRes.ok) {
          const arrayBuffer = await hfRes.arrayBuffer();
          const cutoutBase64 = Buffer.from(arrayBuffer).toString('base64');
          return NextResponse.json({
            success: true,
            image: `data:image/png;base64,${cutoutBase64}`,
            provider: 'huggingface-rmbg',
          });
        }

        console.warn(`[RemoveBG] Hugging Face inference responded with status ${hfRes.status}`);
      } catch (hfErr) {
        console.warn('[RemoveBG] Hugging Face inference failed or timed out:', hfErr);
      }
    }

    // 2. Secondary: remove.bg API
    if (removeBgKey) {
      try {
        const formData = new FormData();
        formData.append('image_file_b64', rawBase64);
        formData.append('size', 'auto');

        const rbgRes = await fetch('https://api.remove.bg/v1.0/removebg', {
          method: 'POST',
          headers: {
            'X-Api-Key': removeBgKey,
          },
          body: formData,
          signal: AbortSignal.timeout(15000),
        });

        if (rbgRes.ok) {
          const arrayBuffer = await rbgRes.arrayBuffer();
          const cutoutBase64 = Buffer.from(arrayBuffer).toString('base64');
          return NextResponse.json({
            success: true,
            image: `data:image/png;base64,${cutoutBase64}`,
            provider: 'removebg',
          });
        }

        console.warn(`[RemoveBG] remove.bg responded with status ${rbgRes.status}`);
      } catch (rbgErr) {
        console.warn('[RemoveBG] remove.bg failed or timed out:', rbgErr);
      }
    }

    // 3. Graceful fallback when no key is set or upstream failed
    return NextResponse.json({
      success: false,
      fallback: true,
      reason: hfToken || removeBgKey ? 'UPSTREAM_UNAVAILABLE' : 'NO_PROVIDER_CONFIGURED',
      message: 'Background removal provider unavailable; preserving original image.',
    });
  } catch (error) {
    console.error('[RemoveBG] Unexpected error in remove-bg route:', error);
    return NextResponse.json({
      success: false,
      fallback: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
