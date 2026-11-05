import type { IdiomaConfig as CoreConfig } from '@idioma/core/internal';
import type { generateText, LanguageModel } from 'ai';
import { z } from 'zod';

export type { LanguageModel } from 'ai';

/** Provider options, as the AI SDK's generateText takes them */
export type ProviderOptions = Parameters<
  typeof generateText
>[0]['providerOptions'];

/** The `ai` block of idioma.config.ts, for `idioma translate` */
export interface AiConfig {
  /**
   * The model to translate with: any AI SDK 6 model, such as
   * `anthropic('claude-sonnet-5-5')` from `@ai-sdk/anthropic`. The provider
   * reads its API key from the environment.
   */
  model?: LanguageModel;
  /** Your app's tone, audience and style, sent with every request */
  guidelines?: string;
  /** Options passed to the provider, such as thinking settings */
  providerOptions?: ProviderOptions;
}

/** idioma.config.ts, with the `ai` block typed */
export type IdiomaConfig = Omit<CoreConfig, 'ai'> & { ai?: AiConfig };

/**
 * Type-safe config helper for a project that translates with
 * `idioma translate`. It is @idioma/core's `defineConfig`, with the `ai`
 * block typed: core doesn't know the AI settings.
 */
export function defineConfig(config: IdiomaConfig): IdiomaConfig {
  return config;
}

// The model and provider options can't be checked at runtime: the AI SDK
// checks them when it calls the model.
const AiConfigSchema = z
  .object({
    model: z.any().optional(),
    guidelines: z.string().optional(),
    providerOptions: z.record(z.string(), z.any()).optional(),
  })
  .optional();

/**
 * The `ai` block as `loadConfig` returned it. Core keeps it without
 * checking it, so this is where a mistake in it is reported.
 */
export function readAiConfig(ai: unknown): AiConfig {
  const result = AiConfigSchema.safeParse(ai);
  if (!result.success) {
    const issues = result.error.issues
      .map(
        (issue) =>
          `  - ai.${issue.path.join('.') || '(root)'}: ${issue.message}`,
      )
      .join('\n');
    throw new Error(`Invalid ai settings in idioma.config.ts:\n${issues}`);
  }
  return (result.data ?? {}) as AiConfig;
}
