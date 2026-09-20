import { GoogleGenAI, type Schema } from '@google/genai';
import { z } from 'zod';
import { config } from '@/lib/config';
import { serverEnv } from '@/lib/serverEnv';
import { withGeminiRetry } from '@/lib/rateLimiter';
import { logger } from '@/lib/logger';

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | null = null;

export async function getGenAIClient(): Promise<GoogleGenAI> {
  const apiKey =
    (await serverEnv('GEMINI_API_KEY')) ||
    config.ai.gemini.apiKey ||
    process.env.GEMINI_API_KEY ||
    '';
  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedKey = apiKey;
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

export interface ModelCallOptions<T> {
  model?: string;
  fallbackModel?: string;
  systemInstruction?: string;
  temperature?: number;
  responseJsonSchema?: unknown;
  zodSchema?: z.ZodType<T>;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Invoke an AI model with structured JSON output and automatic fallback.
 * Used to route micro-tasks (like naming and attribute extraction) to cost-effective Gemma 4,
 * and complex styling/critic reasoning to Gemini 3.5 Flash-Lite.
 */
export async function invokeStructuredModel<T>(
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
  options: ModelCallOptions<T> = {}
): Promise<T> {
  const client = await getGenAIClient();
  const primaryModel = options.model || config.ai.gemini.model;
  const fallbackModel = options.fallbackModel || config.ai.gemini.model;

  // Helper to run a single model call
  const runModel = async (modelName: string): Promise<T> => {
    return withGeminiRetry(
      async () => {
        const response = await client.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction: options.systemInstruction,
            temperature: options.temperature ?? 0.7,
            responseMimeType: 'application/json',
            responseJsonSchema: options.responseJsonSchema as Schema | undefined,
          },
        });

        const text = response.text?.trim() ?? '';
        if (!text) {
          throw new Error(`Empty response from model ${modelName}`);
        }

        const parsedJson = JSON.parse(text);
        if (options.zodSchema) {
          return options.zodSchema.parse(parsedJson);
        }
        return parsedJson as T;
      },
      { maxRetries: options.maxRetries ?? 1, timeoutMs: options.timeoutMs ?? 30000 }
    );
  };

  try {
    return await runModel(primaryModel);
  } catch (primaryError) {
    if (primaryModel !== fallbackModel) {
      logger.warn(`Primary model ${primaryModel} failed, falling back to ${fallbackModel}:`, {
        error: primaryError instanceof Error ? primaryError.message : String(primaryError),
      });
      return await runModel(fallbackModel);
    }
    throw primaryError;
  }
}

/**
 * Micro-Agent: Ingestion, Garment Naming & Tagging
 * Defaults to cost-efficient MoE model gemma-4-26b-a4b-it, with fallback to gemini-3.5-flash-lite.
 */
export async function invokeMicroAgent<T>(
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
  options: Omit<ModelCallOptions<T>, 'model' | 'fallbackModel'> = {}
): Promise<T> {
  return invokeStructuredModel<T>(parts, {
    ...options,
    model: config.ai.gemini.microModel,
    fallbackModel: config.ai.gemini.model,
  });
}

/**
 * Core Stylist & Critic Agent
 * Defaults to gemini-3.5-flash-lite for deep combinatorial reasoning, silhouette and color theory.
 */
export async function invokeStylistAgent<T>(
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
  options: Omit<ModelCallOptions<T>, 'model'> = {}
): Promise<T> {
  return invokeStructuredModel<T>(parts, {
    ...options,
    model: config.ai.gemini.model,
    fallbackModel: config.ai.gemini.denseModel || config.ai.gemini.model,
  });
}
