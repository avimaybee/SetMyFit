import { GoogleGenAI } from '@google/genai';
import { IClothingItem } from '@/lib/types';
import { config } from '@/lib/config';
import { withGeminiRetry } from '@/lib/rateLimiter';
import { fetchValidationImage } from '@/lib/helpers/aiOutfitAnalyzer';

/**
 * Outfit visual generation (Nano Banana).
 *
 * Renders the selected wardrobe pieces as one flat-lay outfit photo using
 * `gemini-3.1-flash-image` with the actual item photos as references.
 * Output is stored on R2 by the caller (`POST /api/outfits/visual`).
 */

const MAX_REF_IMAGES = 6;

export interface OutfitVisualResult {
  imageBase64: string;
  mimeType: string;
  textNote?: string;
}

let cachedClient: GoogleGenAI | null = null;
const getClient = () => {
  if (!config.ai.gemini.apiKey) {
    throw new Error('Gemini API key not configured');
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey: config.ai.gemini.apiKey });
  }
  return cachedClient;
};

export async function generateOutfitVisual(
  items: IClothingItem[],
  opts: { occasion?: string; vibe?: string } = {}
): Promise<OutfitVisualResult> {
  const candidates = items.filter((item) => item.image_url).slice(0, MAX_REF_IMAGES);
  if (candidates.length < 2) {
    throw new Error('Need at least 2 item photos to render a look.');
  }

  const fetched = await Promise.all(
    candidates.map(async (item) => ({
      item,
      image: item.image_url ? await fetchValidationImage(item.image_url) : null,
    }))
  );
  const usable = fetched.filter(
    (entry): entry is { item: IClothingItem; image: { mimeType: string; data: string } } =>
      entry.image !== null
  );
  if (usable.length < 2) {
    throw new Error('Could not load enough item photos to render a look.');
  }

  const catalog = usable
    .map(({ item }) => `- "${item.name}" (${item.type}, ${item.color || 'unknown color'})`)
    .join('\n');

  const prompt = [
    'Create a clean e-commerce flat-lay photograph showing exactly these clothing items arranged as ONE complete outfit on a seamless neutral light-gray background, viewed directly from above.',
    'Preserve every garment faithfully: same colors, patterns, materials, proportions and details as the reference photos.',
    `Items:\n${catalog}`,
    opts.occasion ? `Styling vibe: ${opts.occasion}.` : '',
    opts.vibe ? `Aesthetic: ${opts.vibe}.` : '',
    'Rules: no people, no mannequins, no hangers, no text, no logos, no watermark. Soft even studio lighting, gentle shadows.',
  ]
    .filter(Boolean)
    .join('\n');

  const result = await withGeminiRetry(
    async () => {
      const client = getClient();
      const response = await client.models.generateContent({
        model: config.ai.gemini.imageModel,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              ...usable.map(({ image }) => ({
                inlineData: { mimeType: image.mimeType, data: image.data },
              })),
            ],
          },
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      let textNote: string | undefined;
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
        if (inline?.data) {
          return {
            imageBase64: inline.data,
            mimeType: inline.mimeType || 'image/png',
            textNote,
          };
        }
        const text = (part as { text?: string }).text;
        if (text && !textNote) textNote = text;
      }
      throw new Error('Image model returned no image.');
    },
    { maxRetries: 1, timeoutMs: 90000 }
  );

  return result;
}
