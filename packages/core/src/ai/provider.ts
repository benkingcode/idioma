import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export interface MessageToTranslate {
  key: string
  source: string
  context?: string
}

export interface TranslatedMessage {
  key: string
  translation: string
}

export interface TranslationRequest {
  messages: MessageToTranslate[]
  sourceLocale: string
  targetLocale: string
}

export interface TranslationProvider {
  name: string
  translate(request: TranslationRequest): Promise<TranslatedMessage[]>
}

export interface AnthropicProviderOptions {
  apiKey: string
  model?: string
}

export interface OpenAIProviderOptions {
  apiKey: string
  model?: string
}

const TRANSLATION_SYSTEM_PROMPT = `You are a professional translator. Translate the following messages from {sourceLocale} to {targetLocale}.

Important guidelines:
- Preserve all placeholders like {name}, {count}, {0}, etc. exactly as they appear
- Preserve HTML-like tags like <0>...</0>, <1>...</1> exactly as they appear
- Preserve ICU format syntax like {count, plural, one {...} other {...}}
- Maintain the same tone and formality level as the source
- Consider the context provided (if any) to ensure accurate translation
- Return translations in the exact order they were provided

Each message has a key and source text. Some may have context to help with accurate translation.`

/**
 * Create an Anthropic translation provider.
 */
export function createAnthropicProvider(options: AnthropicProviderOptions): TranslationProvider {
  const { apiKey, model = 'claude-sonnet-4-20250514' } = options

  const client = new Anthropic({ apiKey })

  return {
    name: 'anthropic',
    async translate(request: TranslationRequest): Promise<TranslatedMessage[]> {
      const { messages, sourceLocale, targetLocale } = request

      const systemPrompt = TRANSLATION_SYSTEM_PROMPT
        .replace('{sourceLocale}', sourceLocale)
        .replace('{targetLocale}', targetLocale)

      const userContent = messages
        .map((m, i) => {
          let text = `[${i + 1}] Key: ${m.key}\nSource: ${m.source}`
          if (m.context) {
            text += `\nContext: ${m.context}`
          }
          return text
        })
        .join('\n\n')

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
                      translation: { type: 'string', description: 'The translated text' },
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
      })

      // Extract translations from tool use response
      const toolUse = response.content.find((c) => c.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('No tool use response from Anthropic')
      }

      const input = toolUse.input as { translations: TranslatedMessage[] }
      return input.translations
    },
  }
}

/**
 * Create an OpenAI translation provider.
 */
export function createOpenAIProvider(options: OpenAIProviderOptions): TranslationProvider {
  const { apiKey, model = 'gpt-4o' } = options

  const client = new OpenAI({ apiKey })

  return {
    name: 'openai',
    async translate(request: TranslationRequest): Promise<TranslatedMessage[]> {
      const { messages, sourceLocale, targetLocale } = request

      const systemPrompt = TRANSLATION_SYSTEM_PROMPT
        .replace('{sourceLocale}', sourceLocale)
        .replace('{targetLocale}', targetLocale)

      const userContent = messages
        .map((m, i) => {
          let text = `[${i + 1}] Key: ${m.key}\nSource: ${m.source}`
          if (m.context) {
            text += `\nContext: ${m.context}`
          }
          return text
        })
        .join('\n\n')

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
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      const parsed = JSON.parse(content) as { translations: TranslatedMessage[] }
      return parsed.translations
    },
  }
}
