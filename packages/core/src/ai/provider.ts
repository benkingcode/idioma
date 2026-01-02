import type { generateText as generateTextFn, LanguageModel } from 'ai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { formatBox } from './format.js';

/** Provider options type extracted from generateText parameters */
type ProviderOptions = Parameters<typeof generateTextFn>[0]['providerOptions'];

export interface MessageToTranslate {
  key: string;
  source: string;
  context?: string;
}

export interface TranslatedMessage {
  key: string;
  translation: string;
}

export interface TranslationRequest {
  messages: MessageToTranslate[];
  sourceLocale: string;
  targetLocale: string;
}

export interface TranslationProvider {
  name: string;
  translate(request: TranslationRequest): Promise<TranslatedMessage[]>;
}

export interface TranslationProviderOptions {
  model: LanguageModel;
  /** Project-specific guidelines for AI translation */
  guidelines?: string;
  /** Provider-specific options passed through to generateText() */
  providerOptions?: ProviderOptions;
  /** Callback for verbose logging */
  onVerbose?: (message: string) => void;
}

const TRANSLATION_SYSTEM_PROMPT = `You are an expert translator specializing in software UI localization. Translate the following messages from {sourceLocale} to {targetLocale}.

CRITICAL — Preserve exactly as they appear:
- Placeholders: {name}, {count}, {0}, etc.
- Component tags: <0>...</0>, <1>...</1>
- ICU syntax: {count, plural, one {...} other {...}}
- Whitespace: leading/trailing spaces and newlines

Translation guidelines:
- Match the source's tone and formality level
- Keep translations concise — UI space is limited
- Use context hints (if provided) to choose appropriate wording
- Return translations in the exact order provided (matching [1], [2], etc.)

Do NOT:
- Add words, explanations, or politeness not in the source
- Translate brand names, product names, or technical terms (keep in original language)
- Change questions to statements or vice versa
- Translate placeholder names inside {braces}

Each message is numbered [1], [2], etc. Some may include context to help with accurate translation. Return translations with their numeric ID.`;

/**
 * Build the system prompt for translation, optionally including user guidelines.
 */
export function buildTranslationSystemPrompt(
  sourceLocale: string,
  targetLocale: string,
  guidelines?: string,
): string {
  let prompt = TRANSLATION_SYSTEM_PROMPT.replace(
    '{sourceLocale}',
    sourceLocale,
  ).replace('{targetLocale}', targetLocale);

  if (guidelines) {
    prompt += `

Project-specific guidelines from the developer:
${guidelines}`;
  }

  return prompt;
}

/**
 * Zod schema for structured translation output.
 * Uses numeric IDs (matching [1], [2], etc. in prompt) rather than echoing
 * the original keys, which may contain special characters like \u0004.
 */
const TranslationResultSchema = z.object({
  translations: z.array(
    z.object({
      id: z.number(),
      translation: z.string(),
    }),
  ),
});

/**
 * Create a translation provider using the Vercel AI SDK.
 * Accepts any LanguageModel from @ai-sdk/* packages.
 */
export function createTranslationProvider(
  options: TranslationProviderOptions,
): TranslationProvider {
  const { model, guidelines, providerOptions, onVerbose } = options;

  return {
    name: 'ai-sdk',
    async translate(request: TranslationRequest): Promise<TranslatedMessage[]> {
      const { messages, sourceLocale, targetLocale } = request;

      const systemPrompt = buildTranslationSystemPrompt(
        sourceLocale,
        targetLocale,
        guidelines,
      );

      const userContent = messages
        .map((m, i) => {
          // Don't include the internal key in the prompt - use position instead
          // Keys may contain special characters like \u0004 that AI can't preserve
          let text = `[${i + 1}] ${m.source}`;
          if (m.context) {
            text += `\nContext: ${m.context}`;
          }
          return text;
        })
        .join('\n\n');

      if (onVerbose) {
        onVerbose(formatBox('System Prompt', systemPrompt));
        onVerbose(formatBox('User Content', userContent));
      }

      const result = await generateText({
        model,
        output: Output.object({ schema: TranslationResultSchema }),
        system: systemPrompt,
        prompt: userContent,
        providerOptions,
      });

      if (!result.output) {
        throw new Error('No output from AI provider');
      }

      // Match translations back to original keys by numeric ID
      const translations = result.output.translations;
      return translations.map((t) => {
        const index = t.id - 1; // IDs are 1-indexed in the prompt
        const message = messages[index];
        if (!message) {
          throw new Error(`AI returned invalid ID ${t.id}`);
        }
        return {
          key: message.key,
          translation: t.translation,
        };
      });
    },
  };
}

export interface DryRunProviderOptions {
  /** Project-specific guidelines for AI translation */
  guidelines?: string;
  /** Callback for verbose logging */
  onVerbose?: (message: string) => void;
}

/**
 * Create a dry run translation provider that returns "Dry run" for all messages
 * without making any AI API calls. Still logs prompts in verbose mode.
 */
export function createDryRunProvider(
  options: DryRunProviderOptions = {},
): TranslationProvider {
  const { guidelines, onVerbose } = options;

  return {
    name: 'dry-run',
    async translate(request: TranslationRequest): Promise<TranslatedMessage[]> {
      const { messages, sourceLocale, targetLocale } = request;

      if (onVerbose) {
        const systemPrompt = buildTranslationSystemPrompt(
          sourceLocale,
          targetLocale,
          guidelines,
        );

        const userContent = messages
          .map((m, i) => {
            // Same format as real provider - no key in prompt
            let text = `[${i + 1}] ${m.source}`;
            if (m.context) {
              text += `\nContext: ${m.context}`;
            }
            return text;
          })
          .join('\n\n');

        onVerbose(formatBox('System Prompt', systemPrompt));
        onVerbose(formatBox('User Content', userContent));
      }

      return messages.map((m) => ({
        key: m.key,
        translation: 'Dry run',
      }));
    },
  };
}
