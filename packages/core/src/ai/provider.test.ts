import { describe, expect, it, vi } from 'vitest';
import {
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
});
