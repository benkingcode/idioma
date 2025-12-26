import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Catalog, Message } from '../po/types';
import {
  addAIContext,
  AI_CONTEXT_PREFIX,
  buildContextSystemPrompt,
  createAnthropicContextProvider,
  createOpenAIContextProvider,
  generateContextForCatalog,
  groupMessagesByFile,
  hasAIContext,
  needsContextGeneration,
  parseReference,
  type ContextProvider,
  type FileContextRequest,
  type GeneratedContext,
  type MessageForContext,
} from './context';

describe('Context Generation Utilities', () => {
  describe('AI_CONTEXT_PREFIX', () => {
    it('is a recognizable prefix for AI-generated context', () => {
      expect(AI_CONTEXT_PREFIX).toBe('[AI Context]:');
    });
  });

  describe('parseReference', () => {
    it('parses file:line format', () => {
      const result = parseReference('src/App.tsx:42');
      expect(result).toEqual({ filePath: 'src/App.tsx', line: 42 });
    });

    it('handles paths with colons (Windows-style)', () => {
      const result = parseReference('C:/Users/dev/App.tsx:10');
      expect(result).toEqual({ filePath: 'C:/Users/dev/App.tsx', line: 10 });
    });

    it('returns null for invalid format', () => {
      expect(parseReference('invalid')).toBeNull();
      expect(parseReference('')).toBeNull();
      expect(parseReference('file.tsx')).toBeNull();
    });

    it('returns null for non-numeric line', () => {
      expect(parseReference('file.tsx:abc')).toBeNull();
    });
  });

  describe('hasAIContext', () => {
    it('returns true when message has AI context comment', () => {
      const message: Message = {
        key: 'test',
        source: 'Hello',
        translation: '',
        comments: ['[AI Context]: Greeting on homepage'],
      };
      expect(hasAIContext(message)).toBe(true);
    });

    it('returns false when message has no comments', () => {
      const message: Message = {
        key: 'test',
        source: 'Hello',
        translation: '',
      };
      expect(hasAIContext(message)).toBe(false);
    });

    it('returns false when comments exist but none are AI context', () => {
      const message: Message = {
        key: 'test',
        source: 'Hello',
        translation: '',
        comments: ['Human note', 'Another note'],
      };
      expect(hasAIContext(message)).toBe(false);
    });

    it('returns true when AI context is among other comments', () => {
      const message: Message = {
        key: 'test',
        source: 'Hello',
        translation: '',
        comments: ['Human note', '[AI Context]: Button label'],
      };
      expect(hasAIContext(message)).toBe(true);
    });
  });

  describe('needsContextGeneration', () => {
    it('returns true for message without context or AI context', () => {
      const message: Message = {
        key: 'test',
        source: 'Hello',
        translation: '',
      };
      expect(needsContextGeneration(message)).toBe(true);
    });

    it('returns false when message has explicit context (msgctxt)', () => {
      const message: Message = {
        key: 'test',
        source: 'Hello',
        translation: '',
        context: 'greeting',
      };
      expect(needsContextGeneration(message)).toBe(false);
    });

    it('returns false when message already has AI-generated context', () => {
      const message: Message = {
        key: 'test',
        source: 'Hello',
        translation: '',
        comments: ['[AI Context]: Greeting on homepage'],
      };
      expect(needsContextGeneration(message)).toBe(false);
    });

    it('returns false when message has any comments (developer or AI)', () => {
      const message: Message = {
        key: 'test',
        source: 'Hello',
        translation: '',
        comments: ['Some developer note'],
      };
      // Skip AI context generation if message already has any comments
      expect(needsContextGeneration(message)).toBe(false);
    });
  });

  describe('addAIContext', () => {
    it('adds AI context to message without comments', () => {
      const message: Message = {
        key: 't',
        source: 'x',
        translation: '',
      };

      addAIContext(message, 'Test context');

      expect(message.comments).toEqual(['[AI Context]: Test context']);
    });

    it('adds AI context while preserving human comments', () => {
      const message: Message = {
        key: 't',
        source: 'x',
        translation: '',
        comments: ['Human note'],
      };

      addAIContext(message, 'Test context');

      expect(message.comments).toEqual([
        'Human note',
        '[AI Context]: Test context',
      ]);
    });

    it('replaces existing AI context', () => {
      const message: Message = {
        key: 't',
        source: 'x',
        translation: '',
        comments: ['[AI Context]: Old context', 'Human note'],
      };

      addAIContext(message, 'New context');

      expect(message.comments).toEqual([
        'Human note',
        '[AI Context]: New context',
      ]);
    });
  });

  describe('groupMessagesByFile', () => {
    it('groups messages by source file from references', () => {
      const messages = new Map<string, Message>([
        [
          'key1',
          {
            key: 'key1',
            source: 'Hello',
            translation: '',
            references: ['src/App.tsx:10'],
          },
        ],
        [
          'key2',
          {
            key: 'key2',
            source: 'World',
            translation: '',
            references: ['src/App.tsx:20'],
          },
        ],
        [
          'key3',
          {
            key: 'key3',
            source: 'Other',
            translation: '',
            references: ['src/Page.tsx:5'],
          },
        ],
      ]);

      const grouped = groupMessagesByFile(messages);

      expect(grouped.get('src/App.tsx')).toHaveLength(2);
      expect(grouped.get('src/Page.tsx')).toHaveLength(1);
    });

    it('skips messages without references', () => {
      const messages = new Map<string, Message>([
        [
          'no-ref',
          {
            key: 'no-ref',
            source: 'Test',
            translation: '',
            references: [],
          },
        ],
      ]);

      const grouped = groupMessagesByFile(messages);

      expect(grouped.size).toBe(0);
    });

    it('skips messages with undefined references', () => {
      const messages = new Map<string, Message>([
        [
          'no-ref',
          {
            key: 'no-ref',
            source: 'Test',
            translation: '',
          },
        ],
      ]);

      const grouped = groupMessagesByFile(messages);

      expect(grouped.size).toBe(0);
    });

    it('uses first reference when multiple exist', () => {
      const messages = new Map<string, Message>([
        [
          'multi',
          {
            key: 'multi',
            source: 'Test',
            translation: '',
            references: ['src/A.tsx:1', 'src/B.tsx:2'],
          },
        ],
      ]);

      const grouped = groupMessagesByFile(messages);

      expect(grouped.has('src/A.tsx')).toBe(true);
      expect(grouped.has('src/B.tsx')).toBe(false);
    });

    it('skips messages that already have AI context', () => {
      const messages = new Map<string, Message>([
        [
          'has-context',
          {
            key: 'has-context',
            source: 'Test',
            translation: '',
            references: ['src/App.tsx:1'],
            comments: ['[AI Context]: Already has context'],
          },
        ],
      ]);

      const grouped = groupMessagesByFile(messages);

      expect(grouped.size).toBe(0);
    });

    it('skips messages with explicit context (msgctxt)', () => {
      const messages = new Map<string, Message>([
        [
          'has-msgctxt',
          {
            key: 'has-msgctxt',
            source: 'Test',
            translation: '',
            references: ['src/App.tsx:1'],
            context: 'button',
          },
        ],
      ]);

      const grouped = groupMessagesByFile(messages);

      expect(grouped.size).toBe(0);
    });

    it('includes correct line numbers in grouped messages', () => {
      const messages = new Map<string, Message>([
        [
          'key1',
          {
            key: 'key1',
            source: 'Hello',
            translation: '',
            references: ['src/App.tsx:42'],
          },
        ],
      ]);

      const grouped = groupMessagesByFile(messages);
      const appMessages = grouped.get('src/App.tsx');

      expect(appMessages).toBeDefined();
      expect(appMessages![0]).toEqual({
        key: 'key1',
        source: 'Hello',
        line: 42,
      } satisfies MessageForContext);
    });
  });
});

describe('Context Providers', () => {
  describe('ContextProvider interface', () => {
    it('defines the generateContext method', () => {
      const mockProvider: ContextProvider = {
        generateContext: vi
          .fn()
          .mockResolvedValue([{ key: 'test', context: 'Button label' }]),
      };

      expect(mockProvider.generateContext).toBeDefined();
    });
  });

  describe('createAnthropicContextProvider', () => {
    it('creates a provider with generateContext method', () => {
      const provider = createAnthropicContextProvider({ apiKey: 'test-key' });
      expect(typeof provider.generateContext).toBe('function');
    });

    it('uses custom model if provided', () => {
      const provider = createAnthropicContextProvider({
        apiKey: 'test-key',
        model: 'claude-3-haiku-20240307',
      });
      expect(typeof provider.generateContext).toBe('function');
    });

    it('accepts guidelines option', () => {
      const provider = createAnthropicContextProvider({
        apiKey: 'test-key',
        guidelines: 'This is a formal business app.',
      });
      expect(typeof provider.generateContext).toBe('function');
    });
  });

  describe('createOpenAIContextProvider', () => {
    it('creates a provider with generateContext method', () => {
      const provider = createOpenAIContextProvider({ apiKey: 'test-key' });
      expect(typeof provider.generateContext).toBe('function');
    });

    it('uses custom model if provided', () => {
      const provider = createOpenAIContextProvider({
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });
      expect(typeof provider.generateContext).toBe('function');
    });

    it('accepts guidelines option', () => {
      const provider = createOpenAIContextProvider({
        apiKey: 'test-key',
        guidelines: 'This is a formal business app.',
      });
      expect(typeof provider.generateContext).toBe('function');
    });
  });

  describe('FileContextRequest structure', () => {
    it('includes required fields', () => {
      const request: FileContextRequest = {
        filePath: 'src/App.tsx',
        fileContent: 'const App = () => <button>Click me</button>;',
        messages: [{ key: 'btn', source: 'Click me', line: 1 }],
      };

      expect(request.filePath).toBe('src/App.tsx');
      expect(request.fileContent).toContain('Click me');
      expect(request.messages).toHaveLength(1);
    });
  });

  describe('buildContextSystemPrompt', () => {
    it('includes base context instructions', () => {
      const prompt = buildContextSystemPrompt();
      expect(prompt).toContain('technical writer');
      expect(prompt).toContain('UI element');
    });

    it('includes brevity guidance', () => {
      const prompt = buildContextSystemPrompt();
      expect(prompt).toContain('1-2 sentences');
    });

    it('includes ICU pattern awareness', () => {
      const prompt = buildContextSystemPrompt();
      expect(prompt).toContain('plural');
    });

    it('includes example contexts', () => {
      const prompt = buildContextSystemPrompt();
      expect(prompt).toContain('Button');
      expect(prompt).toContain('Error');
    });

    it('includes guidance on what NOT to do', () => {
      const prompt = buildContextSystemPrompt();
      expect(prompt).toContain('Do NOT');
    });

    it('does not include guidelines section when not provided', () => {
      const prompt = buildContextSystemPrompt();
      expect(prompt).not.toContain('Project-specific guidelines');
    });

    it('includes guidelines section when provided', () => {
      const prompt = buildContextSystemPrompt(
        "This is a children's educational app.",
      );
      expect(prompt).toContain(
        'Project-specific guidelines from the developer:',
      );
      expect(prompt).toContain("This is a children's educational app.");
    });
  });
});

describe('generateContextForCatalog', () => {
  const testDir = join(__dirname, '__test_fixtures__');
  const srcDir = join(testDir, 'src');

  beforeEach(() => {
    // Create test directories
    if (!existsSync(srcDir)) {
      mkdirSync(srcDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directories
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  function createMockContextProvider(
    responses: Record<string, string>,
  ): ContextProvider {
    return {
      generateContext: vi
        .fn()
        .mockImplementation(
          async (request: FileContextRequest): Promise<GeneratedContext[]> => {
            return request.messages.map((m) => ({
              key: m.key,
              context: responses[m.key] ?? 'Default context',
            }));
          },
        ),
    };
  }

  function createCatalog(messages: Message[]): Catalog {
    const map = new Map<string, Message>();
    for (const msg of messages) {
      map.set(msg.key, msg);
    }
    return {
      locale: 'es',
      headers: {},
      messages: map,
    };
  }

  it('generates context for messages and updates catalog', async () => {
    // Create source file
    writeFileSync(
      join(srcDir, 'App.tsx'),
      'const App = () => <button>Click me</button>;',
    );

    const catalog = createCatalog([
      {
        key: 'btn',
        source: 'Click me',
        translation: '',
        references: ['src/App.tsx:1'],
      },
    ]);

    const mockProvider = createMockContextProvider({
      btn: 'Button label for primary action',
    });

    const result = await generateContextForCatalog({
      projectRoot: testDir,
      catalog,
      provider: mockProvider,
    });

    expect(result.generated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.failedFiles).toHaveLength(0);

    // Check that catalog was updated
    const message = catalog.messages.get('btn');
    expect(message?.comments).toContain(
      '[AI Context]: Button label for primary action',
    );
  });

  it('skips messages with existing AI context', async () => {
    writeFileSync(join(srcDir, 'App.tsx'), 'const x = 1;');

    const catalog = createCatalog([
      {
        key: 'existing',
        source: 'Already has context',
        translation: '',
        references: ['src/App.tsx:1'],
        comments: ['[AI Context]: Pre-existing context'],
      },
    ]);

    const mockProvider = createMockContextProvider({});

    const result = await generateContextForCatalog({
      projectRoot: testDir,
      catalog,
      provider: mockProvider,
    });

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(1);
    // Provider should not be called
    expect(mockProvider.generateContext).not.toHaveBeenCalled();
  });

  it('skips messages with explicit context (msgctxt)', async () => {
    writeFileSync(join(srcDir, 'App.tsx'), 'const x = 1;');

    const catalog = createCatalog([
      {
        key: 'has-msgctxt',
        source: 'Has context',
        translation: '',
        references: ['src/App.tsx:1'],
        context: 'button',
      },
    ]);

    const mockProvider = createMockContextProvider({});

    const result = await generateContextForCatalog({
      projectRoot: testDir,
      catalog,
      provider: mockProvider,
    });

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockProvider.generateContext).not.toHaveBeenCalled();
  });

  it('silently skips missing source files', async () => {
    // Don't create the source file

    const catalog = createCatalog([
      {
        key: 'missing',
        source: 'File does not exist',
        translation: '',
        references: ['src/NonExistent.tsx:1'],
      },
    ]);

    const mockProvider = createMockContextProvider({});

    const result = await generateContextForCatalog({
      projectRoot: testDir,
      catalog,
      provider: mockProvider,
    });

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failedFiles).toContain('src/NonExistent.tsx');
  });

  it('batches messages by file for efficiency', async () => {
    // Create source files
    writeFileSync(join(srcDir, 'A.tsx'), 'const A = () => <div>A</div>;');
    writeFileSync(join(srcDir, 'B.tsx'), 'const B = () => <div>B</div>;');

    const catalog = createCatalog([
      {
        key: 'a1',
        source: 'Message A1',
        translation: '',
        references: ['src/A.tsx:1'],
      },
      {
        key: 'a2',
        source: 'Message A2',
        translation: '',
        references: ['src/A.tsx:1'],
      },
      {
        key: 'b1',
        source: 'Message B1',
        translation: '',
        references: ['src/B.tsx:1'],
      },
    ]);

    const mockProvider = createMockContextProvider({
      a1: 'Context A1',
      a2: 'Context A2',
      b1: 'Context B1',
    });

    await generateContextForCatalog({
      projectRoot: testDir,
      catalog,
      provider: mockProvider,
    });

    // Should be called twice (once per file)
    expect(mockProvider.generateContext).toHaveBeenCalledTimes(2);
  });

  it('handles empty catalog', async () => {
    const catalog = createCatalog([]);
    const mockProvider = createMockContextProvider({});

    const result = await generateContextForCatalog({
      projectRoot: testDir,
      catalog,
      provider: mockProvider,
    });

    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(mockProvider.generateContext).not.toHaveBeenCalled();
  });

  it('skips AI context generation when message has existing comments', async () => {
    writeFileSync(join(srcDir, 'App.tsx'), 'const x = 1;');

    const catalog = createCatalog([
      {
        key: 'with-human-comment',
        source: 'Test',
        translation: '',
        references: ['src/App.tsx:1'],
        comments: ['Human-written note'],
      },
    ]);

    const mockProvider = createMockContextProvider({
      'with-human-comment': 'AI generated context',
    });

    const result = await generateContextForCatalog({
      projectRoot: testDir,
      catalog,
      provider: mockProvider,
    });

    // Message with existing comment should be skipped
    const message = catalog.messages.get('with-human-comment');
    expect(message?.comments).toEqual(['Human-written note']);
    expect(message?.comments).not.toContain(
      '[AI Context]: AI generated context',
    );
    expect(result.skipped).toBe(1);
    expect(result.generated).toBe(0);
  });
});
