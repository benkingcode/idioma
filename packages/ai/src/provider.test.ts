import type { LanguageModel } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTranslationSystemPrompt,
  createDryRunProvider,
  createTranslationProvider,
  type TranslationProvider,
  type TranslationRequest,
} from './provider';

// Mock the ai package
vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn((opts: { schema: unknown }) => opts),
  },
}));

describe('AI Translation Providers', () => {
  describe('TranslationProvider interface', () => {
    it('defines the translate method', () => {
      const mockProvider: TranslationProvider = {
        name: 'mock',
        translate: vi
          .fn()
          .mockResolvedValue([{ key: 'test', translation: 'translated' }]),
      };

      expect(mockProvider.translate).toBeDefined();
      expect(mockProvider.name).toBe('mock');
    });
  });

  describe('createTranslationProvider', () => {
    let mockModel: LanguageModel;
    let mockGenerateText: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      // Create a mock LanguageModel
      mockModel = {
        modelId: 'test-model',
        provider: 'test-provider',
        specificationVersion: 'v1',
      } as unknown as LanguageModel;

      // Get the mocked generateText function
      const aiModule = await import('ai');
      mockGenerateText = aiModule.generateText as ReturnType<typeof vi.fn>;
      mockGenerateText.mockReset();
    });

    it('creates a provider with name "ai-sdk"', () => {
      const provider = createTranslationProvider({ model: mockModel });
      expect(provider.name).toBe('ai-sdk');
    });

    it('has a translate method', () => {
      const provider = createTranslationProvider({ model: mockModel });
      expect(typeof provider.translate).toBe('function');
    });

    it('calls generateText with correct parameters', async () => {
      mockGenerateText.mockResolvedValue({
        output: {
          translations: [{ key: 'greeting', translation: 'Hola' }],
        },
      });

      const provider = createTranslationProvider({ model: mockModel });

      const request: TranslationRequest = {
        messages: [{ key: 'greeting', source: 'Hello' }],
        sourceLocale: 'en',
        targetLocale: 'es',
      };

      await provider.translate(request);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: mockModel,
          system: expect.stringContaining('from en to es'),
          prompt: expect.stringContaining('Hello'),
        }),
      );
    });

    it('returns translated messages from AI response', async () => {
      mockGenerateText.mockResolvedValue({
        output: {
          translations: [
            { key: 'greeting', translation: 'Hola' },
            { key: 'farewell', translation: 'Adiós' },
          ],
        },
      });

      const provider = createTranslationProvider({ model: mockModel });

      const request: TranslationRequest = {
        messages: [
          { key: 'greeting', source: 'Hello' },
          { key: 'farewell', source: 'Goodbye' },
        ],
        sourceLocale: 'en',
        targetLocale: 'es',
      };

      const result = await provider.translate(request);

      expect(result).toEqual([
        { key: 'greeting', translation: 'Hola' },
        { key: 'farewell', translation: 'Adiós' },
      ]);
    });

    it('includes context in prompt when provided', async () => {
      mockGenerateText.mockResolvedValue({
        output: {
          translations: [{ key: 'greeting', translation: 'Hola' }],
        },
      });

      const provider = createTranslationProvider({ model: mockModel });

      const request: TranslationRequest = {
        messages: [
          { key: 'greeting', source: 'Hello', context: 'Informal greeting' },
        ],
        sourceLocale: 'en',
        targetLocale: 'es',
      };

      await provider.translate(request);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Context: Informal greeting'),
        }),
      );
    });

    it('passes providerOptions through to generateText', async () => {
      mockGenerateText.mockResolvedValue({
        output: {
          translations: [{ key: 'greeting', translation: 'Hola' }],
        },
      });

      const providerOptions = {
        anthropic: { thinking: { type: 'enabled', budgetTokens: 10000 } },
      };

      const provider = createTranslationProvider({
        model: mockModel,
        providerOptions,
      });

      const request: TranslationRequest = {
        messages: [{ key: 'greeting', source: 'Hello' }],
        sourceLocale: 'en',
        targetLocale: 'es',
      };

      await provider.translate(request);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          providerOptions,
        }),
      );
    });

    it('includes guidelines in system prompt when provided', async () => {
      mockGenerateText.mockResolvedValue({
        output: {
          translations: [{ key: 'greeting', translation: 'Hola' }],
        },
      });

      const provider = createTranslationProvider({
        model: mockModel,
        guidelines: 'Use formal language for this business app.',
      });

      const request: TranslationRequest = {
        messages: [{ key: 'greeting', source: 'Hello' }],
        sourceLocale: 'en',
        targetLocale: 'es',
      };

      await provider.translate(request);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining(
            'Use formal language for this business app.',
          ),
        }),
      );
    });

    it('calls onVerbose callback when provided', async () => {
      mockGenerateText.mockResolvedValue({
        output: {
          translations: [{ key: 'greeting', translation: 'Hola' }],
        },
      });

      const onVerbose = vi.fn();
      const provider = createTranslationProvider({
        model: mockModel,
        onVerbose,
      });

      const request: TranslationRequest = {
        messages: [{ key: 'greeting', source: 'Hello' }],
        sourceLocale: 'en',
        targetLocale: 'es',
      };

      await provider.translate(request);

      expect(onVerbose).toHaveBeenCalled();
    });

    it('throws when generateText returns no output', async () => {
      mockGenerateText.mockResolvedValue({
        output: null,
      });

      const provider = createTranslationProvider({ model: mockModel });

      const request: TranslationRequest = {
        messages: [{ key: 'greeting', source: 'Hello' }],
        sourceLocale: 'en',
        targetLocale: 'es',
      };

      await expect(provider.translate(request)).rejects.toThrow(
        'No output from AI provider',
      );
    });
  });

  describe('createDryRunProvider', () => {
    it('creates a provider with name "dry-run"', () => {
      const provider = createDryRunProvider();
      expect(provider.name).toBe('dry-run');
    });

    it('does not require an API key', () => {
      const provider = createDryRunProvider();
      expect(typeof provider.translate).toBe('function');
    });

    it('returns "Dry run" translation for all messages without calling AI', async () => {
      const provider = createDryRunProvider();

      const request: TranslationRequest = {
        messages: [
          { key: 'greeting', source: 'Hello' },
          { key: 'farewell', source: 'Goodbye', context: 'End of session' },
        ],
        sourceLocale: 'en',
        targetLocale: 'es',
      };

      const result = await provider.translate(request);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ key: 'greeting', translation: 'Dry run' });
      expect(result[1]).toEqual({ key: 'farewell', translation: 'Dry run' });
    });

    it('handles empty messages array', async () => {
      const provider = createDryRunProvider();

      const request: TranslationRequest = {
        messages: [],
        sourceLocale: 'en',
        targetLocale: 'fr',
      };

      const result = await provider.translate(request);

      expect(result).toHaveLength(0);
    });
  });

  describe('TranslationRequest structure', () => {
    it('includes required fields', () => {
      const request: TranslationRequest = {
        messages: [
          { key: 'greeting', source: 'Hello', context: 'Homepage greeting' },
        ],
        sourceLocale: 'en',
        targetLocale: 'es',
      };

      expect(request.messages).toHaveLength(1);
      expect(request.sourceLocale).toBe('en');
      expect(request.targetLocale).toBe('es');
    });

    it('supports optional context on messages', () => {
      const request: TranslationRequest = {
        messages: [{ key: 'greeting', source: 'Hello' }],
        sourceLocale: 'en',
        targetLocale: 'fr',
      };

      expect(request.messages[0].context).toBeUndefined();
    });
  });

  describe('buildTranslationSystemPrompt', () => {
    it('includes source and target locales', () => {
      const prompt = buildTranslationSystemPrompt('en', 'es');
      expect(prompt).toContain('from en to es');
    });

    it('includes base translation instructions', () => {
      const prompt = buildTranslationSystemPrompt('en', 'fr');
      expect(prompt).toContain('translator');
      expect(prompt).toContain('Placeholders');
    });

    it('includes preservation rules for placeholders and tags', () => {
      const prompt = buildTranslationSystemPrompt('en', 'es');
      expect(prompt).toContain('{name}');
      expect(prompt).toContain('<0>');
      expect(prompt).toContain('ICU');
    });

    it('includes guidance on what NOT to do', () => {
      const prompt = buildTranslationSystemPrompt('en', 'es');
      expect(prompt).toContain('Do NOT');
      expect(prompt).toContain('brand names');
    });

    it('includes whitespace preservation guidance', () => {
      const prompt = buildTranslationSystemPrompt('en', 'es');
      expect(prompt).toContain('Whitespace');
    });

    it('includes UI length awareness', () => {
      const prompt = buildTranslationSystemPrompt('en', 'es');
      expect(prompt).toContain('concise');
    });

    it('does not include guidelines section when not provided', () => {
      const prompt = buildTranslationSystemPrompt('en', 'de');
      expect(prompt).not.toContain('Project-specific guidelines');
    });

    it('includes guidelines section when provided', () => {
      const prompt = buildTranslationSystemPrompt(
        'en',
        'es',
        "This is a children's app. Use simple, friendly language.",
      );
      expect(prompt).toContain(
        'Project-specific guidelines from the developer:',
      );
      expect(prompt).toContain("This is a children's app");
      expect(prompt).toContain('Use simple, friendly language');
    });
  });
});
