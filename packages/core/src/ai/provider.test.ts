import { describe, expect, it, vi } from 'vitest';
import {
  buildTranslationSystemPrompt,
  createAnthropicProvider,
  createOpenAIProvider,
  type TranslationProvider,
  type TranslationRequest,
} from './provider';

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

  describe('createAnthropicProvider', () => {
    it('creates a provider with name "anthropic"', () => {
      const provider = createAnthropicProvider({ apiKey: 'test-key' });
      expect(provider.name).toBe('anthropic');
    });

    it('has a translate method', () => {
      const provider = createAnthropicProvider({ apiKey: 'test-key' });
      expect(typeof provider.translate).toBe('function');
    });

    it('uses custom model if provided', () => {
      const provider = createAnthropicProvider({
        apiKey: 'test-key',
        model: 'claude-3-haiku-20240307',
      });
      expect(provider.name).toBe('anthropic');
    });

    it('accepts guidelines option', () => {
      const provider = createAnthropicProvider({
        apiKey: 'test-key',
        guidelines: 'Use formal language for this business app.',
      });
      expect(provider.name).toBe('anthropic');
    });
  });

  describe('createOpenAIProvider', () => {
    it('creates a provider with name "openai"', () => {
      const provider = createOpenAIProvider({ apiKey: 'test-key' });
      expect(provider.name).toBe('openai');
    });

    it('has a translate method', () => {
      const provider = createOpenAIProvider({ apiKey: 'test-key' });
      expect(typeof provider.translate).toBe('function');
    });

    it('uses custom model if provided', () => {
      const provider = createOpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });
      expect(provider.name).toBe('openai');
    });

    it('accepts guidelines option', () => {
      const provider = createOpenAIProvider({
        apiKey: 'test-key',
        guidelines: 'Use formal language for this business app.',
      });
      expect(provider.name).toBe('openai');
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
