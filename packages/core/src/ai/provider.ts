import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { formatBox } from './format.js';

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

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  /** Project-specific guidelines for AI translation */
  guidelines?: string;
  /** Callback for verbose logging */
  onVerbose?: (message: string) => void;
}

export interface OpenAIProviderOptions {
  apiKey: string;
  model?: string;
  /** Project-specific guidelines for AI translation */
  guidelines?: string;
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
- Return translations in the exact order provided

Do NOT:
- Add words, explanations, or politeness not in the source
- Translate brand names, product names, or technical terms (keep in original language)
- Change questions to statements or vice versa
- Translate placeholder names inside {braces}

Each message has a key and source text. Some may include context to help with accurate translation.`;

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
 * Create an Anthropic translation provider.
 */
export function createAnthropicProvider(
  options: AnthropicProviderOptions,
): TranslationProvider {
  const {
    apiKey,
    model = 'claude-sonnet-4-20250514',
    guidelines,
    onVerbose,
  } = options;

  const client = new Anthropic({ apiKey });

  return {
    name: 'anthropic',
    async translate(request: TranslationRequest): Promise<TranslatedMessage[]> {
      const { messages, sourceLocale, targetLocale } = request;

      const systemPrompt = buildTranslationSystemPrompt(
        sourceLocale,
        targetLocale,
        guidelines,
      );

      const userContent = messages
        .map((m, i) => {
          let text = `[${i + 1}] Key: ${m.key}\nSource: ${m.source}`;
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

      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        tools: [
          {
            name: 'submit_translations',
            description: 'Submit the translated messages',
            input_schema: {
              type: 'object' as const,
              properties: {
                translations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string', description: 'The message key' },
                      translation: {
                        type: 'string',
                        description: 'The translated text',
                      },
                    },
                    required: ['key', 'translation'],
                  },
                },
              },
              required: ['translations'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'submit_translations' },
      });

      // Extract translations from tool use response
      const toolUse = response.content.find((c) => c.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('No tool use response from Anthropic');
      }

      const input = toolUse.input as { translations: TranslatedMessage[] };
      return input.translations;
    },
  };
}

/**
 * Create a dry run translation provider that returns "Dry run" for all messages
 * without making any AI API calls.
 */
export function createDryRunProvider(): TranslationProvider {
  return {
    name: 'dry-run',
    async translate(request: TranslationRequest): Promise<TranslatedMessage[]> {
      return request.messages.map((m) => ({
        key: m.key,
        translation: 'Dry run',
      }));
    },
  };
}

/**
 * Create an OpenAI translation provider.
 */
export function createOpenAIProvider(
  options: OpenAIProviderOptions,
): TranslationProvider {
  const { apiKey, model = 'gpt-4o', guidelines, onVerbose } = options;

  const client = new OpenAI({ apiKey });

  return {
    name: 'openai',
    async translate(request: TranslationRequest): Promise<TranslatedMessage[]> {
      const { messages, sourceLocale, targetLocale } = request;

      const systemPrompt = buildTranslationSystemPrompt(
        sourceLocale,
        targetLocale,
        guidelines,
      );

      const userContent = messages
        .map((m, i) => {
          let text = `[${i + 1}] Key: ${m.key}\nSource: ${m.source}`;
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

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'translations',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                translations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      translation: { type: 'string' },
                    },
                    required: ['key', 'translation'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['translations'],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content) as {
        translations: TranslatedMessage[];
      };
      return parsed.translations;
    },
  };
}
