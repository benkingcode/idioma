import { readFile } from 'fs/promises';
import { join } from 'path';
import type { generateText as generateTextFn, LanguageModel } from 'ai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { extractFromFile } from '../cli/commands/extract.js';
import type { Catalog, Message } from '../po/types.js';
import { formatBox, formatHeader, formatKeyValueList } from './format.js';

/** Provider options type extracted from generateText parameters */
type ProviderOptions = Parameters<typeof generateTextFn>[0]['providerOptions'];

/**
 * Prefix used to identify AI-generated context comments in PO files.
 * This allows distinguishing AI context from human-written comments.
 */
export const AI_CONTEXT_PREFIX = '[AI Context]:';

/**
 * Minimal message data needed for context generation.
 */
export interface MessageForContext {
  key: string;
  source: string;
  line: number;
}

/**
 * Request to generate context for messages in a single file.
 */
export interface FileContextRequest {
  filePath: string;
  fileContent: string;
  messages: MessageForContext[];
}

/**
 * AI-generated context for a message.
 */
export interface GeneratedContext {
  key: string;
  context: string;
}

/**
 * Provider interface for AI context generation.
 */
export interface ContextProvider {
  generateContext(request: FileContextRequest): Promise<GeneratedContext[]>;
}

/**
 * Parsed reference containing file path and line number.
 */
export interface ParsedReference {
  filePath: string;
  line: number;
}

/**
 * Parse a reference string (e.g., "src/App.tsx:42" or "src/App.tsx") into file path and line number.
 * Handles paths with colons (like Windows paths) by taking the last colon as the separator.
 * Returns line 0 for references without line numbers.
 */
export function parseReference(reference: string): ParsedReference | null {
  if (!reference) return null;

  // Find the last colon - that's the separator between path and line
  const lastColonIndex = reference.lastIndexOf(':');

  // No colon - treat entire string as file path with line 0
  if (lastColonIndex === -1) {
    // Must look like a file path (has extension)
    if (!reference.includes('.')) return null;
    return { filePath: reference, line: 0 };
  }

  const filePath = reference.slice(0, lastColonIndex);
  const lineStr = reference.slice(lastColonIndex + 1);

  if (!filePath) return null;

  const line = parseInt(lineStr, 10);

  // If the part after colon is not a number, it might be a file path without line number
  // e.g., "src/App.tsx" where there's no colon at all was handled above
  // This handles edge cases like malformed references
  if (isNaN(line)) return null;

  return { filePath, line };
}

/**
 * Check if a message already has AI-generated context.
 */
export function hasAIContext(message: Message): boolean {
  return (
    message.comments?.some((c) => c.startsWith(AI_CONTEXT_PREFIX)) ?? false
  );
}

/**
 * Check if a message needs context generation.
 * Returns false if:
 * - Message has explicit context (msgctxt)
 * - Message already has any comments (developer or AI-generated)
 */
export function needsContextGeneration(message: Message): boolean {
  // Skip if has explicit context (msgctxt)
  if (message.context) return false;

  // Skip if already has any comments (developer or AI)
  // This prevents:
  // - Overwriting developer-provided comments
  // - Regenerating AI context that already exists
  if (message.comments && message.comments.length > 0) return false;

  return true;
}

/**
 * Add AI-generated context to a message.
 * Replaces any existing AI context while preserving human comments.
 */
export function addAIContext(message: Message, context: string): void {
  // Initialize comments if needed
  message.comments = message.comments ?? [];

  // Remove any existing AI context
  message.comments = message.comments.filter(
    (c) => !c.startsWith(AI_CONTEXT_PREFIX),
  );

  // Add new AI context
  message.comments.push(`${AI_CONTEXT_PREFIX} ${context}`);
}

/**
 * Group messages by their source file for batch context generation.
 * Only includes messages that need context generation.
 * Uses the first reference for each message.
 *
 * @param messages - The catalog messages
 * @param sourceTextByKey - Optional lookup for actual source text (for hash-based key systems)
 */
export function groupMessagesByFile(
  messages: Map<string, Message>,
  sourceTextByKey?: Map<string, string>,
): Map<string, MessageForContext[]> {
  const grouped = new Map<string, MessageForContext[]>();

  for (const [key, message] of messages) {
    // Skip if doesn't need context generation
    if (!needsContextGeneration(message)) continue;

    // Skip if no references
    const references = message.references;
    if (!references || references.length === 0) continue;

    // Use first reference
    const firstRef = references[0];
    if (!firstRef) continue;

    const parsed = parseReference(firstRef);
    if (!parsed) continue;

    const { filePath, line } = parsed;

    // Get actual source text - prefer lookup, fallback to message.source
    const sourceText = sourceTextByKey?.get(key) ?? message.source;

    // Add to group
    const group = grouped.get(filePath) ?? [];
    group.push({
      key,
      source: sourceText,
      line,
    });
    grouped.set(filePath, group);
  }

  return grouped;
}

// ============================================================================
// Context Providers
// ============================================================================

export interface ContextProviderOptions {
  model: LanguageModel;
  /** Project-specific guidelines for AI context generation */
  guidelines?: string;
  /** Provider-specific options passed through to generateText() */
  providerOptions?: ProviderOptions;
  /** Callback for verbose logging */
  onVerbose?: (message: string) => void;
}

const CONTEXT_GENERATION_SYSTEM_PROMPT = `You are a technical writer helping translators understand UI text.

Given a source file and a list of translatable text strings with their line numbers:
1. Analyze where each string appears in the code
2. Generate a brief, helpful context for translators

Context guidelines:
- Describe what UI element displays the text (button, heading, error message, tooltip, etc.)
- Explain when/where users see this text
- Note any important formatting or length constraints
- Mention related user actions or workflow context
- For ICU patterns like {count, plural, ...}, explain what values trigger each form (e.g., "one" for exactly 1, "other" for 0 or 2+)
- Keep each context to 1-2 sentences maximum

Example contexts:
- "Button label in checkout form to confirm purchase"
- "Error shown when password is under 8 characters"
- "Pluralized count: 'one' for exactly 1 item, 'other' for 0 or 2+"
- "Page heading for user profile settings"

Do NOT:
- Suggest translations
- Describe or paraphrase the source text itself
- Include technical implementation details
- Reference variable names or code structure`;

/**
 * Build the system prompt for context generation, optionally including user guidelines.
 */
export function buildContextSystemPrompt(guidelines?: string): string {
  let prompt = CONTEXT_GENERATION_SYSTEM_PROMPT;

  if (guidelines) {
    prompt += `

Project-specific guidelines from the developer:
${guidelines}

Use these guidelines to inform the context you generate.`;
  }

  return prompt;
}

/**
 * Format messages for context generation request.
 */
function formatContextRequest(request: FileContextRequest): string {
  const messageList = request.messages
    .map((m, i) => {
      const lineInfo = m.line > 0 ? `Line ${m.line}: ` : '';
      return `[${i + 1}] ${lineInfo}"${m.source}" (key: ${m.key})`;
    })
    .join('\n');

  return `File: ${request.filePath}

Source code:
\`\`\`
${request.fileContent}
\`\`\`

Generate context for these translatable strings:
${messageList}`;
}

/**
 * Zod schema for structured context output
 */
const ContextResultSchema = z.object({
  contexts: z.array(
    z.object({
      key: z.string(),
      context: z.string(),
    }),
  ),
});

/**
 * Create a context provider using the Vercel AI SDK.
 * Accepts any LanguageModel from @ai-sdk/* packages.
 */
export function createContextProvider(
  options: ContextProviderOptions,
): ContextProvider {
  const { model, guidelines, providerOptions, onVerbose } = options;
  const systemPrompt = buildContextSystemPrompt(guidelines);

  return {
    async generateContext(
      request: FileContextRequest,
    ): Promise<GeneratedContext[]> {
      const userContent = formatContextRequest(request);

      if (onVerbose) {
        onVerbose(
          `\n${formatHeader(`Context Generation: ${request.filePath} (${request.messages.length} messages)`)}`,
        );
        onVerbose(formatBox('System Prompt', systemPrompt));
        onVerbose(formatBox('User Content', userContent));
      }

      const result = await generateText({
        model,
        output: Output.object({ schema: ContextResultSchema }),
        system: systemPrompt,
        prompt: userContent,
        providerOptions,
      });

      if (!result.output) {
        throw new Error('No output from AI provider');
      }

      if (onVerbose) {
        onVerbose(
          formatBox(
            'Response',
            formatKeyValueList(
              result.output.contexts.map((c) => ({
                key: c.key,
                value: c.context,
              })),
            ),
          ),
        );
      }

      return result.output.contexts;
    },
  };
}

export interface DryRunContextProviderOptions {
  /** Project-specific guidelines for AI context generation */
  guidelines?: string;
  /** Callback for verbose logging */
  onVerbose?: (message: string) => void;
}

/**
 * Create a dry run context provider that returns "Dry run" for all messages
 * without making any AI API calls. Still logs prompts in verbose mode.
 */
export function createDryRunContextProvider(
  options: DryRunContextProviderOptions = {},
): ContextProvider {
  const { guidelines, onVerbose } = options;
  const systemPrompt = buildContextSystemPrompt(guidelines);

  return {
    async generateContext(
      request: FileContextRequest,
    ): Promise<GeneratedContext[]> {
      if (onVerbose) {
        const userContent = formatContextRequest(request);

        onVerbose(
          `\n${formatHeader(`Context Generation: ${request.filePath} (${request.messages.length} messages)`)}`,
        );
        onVerbose(formatBox('System Prompt', systemPrompt));
        onVerbose(formatBox('User Content', userContent));
      }

      return request.messages.map((m) => ({
        key: m.key,
        context: 'Dry run',
      }));
    },
  };
}

// ============================================================================
// Orchestration
// ============================================================================

/**
 * Progress information for context generation file completion callback.
 */
export interface ContextFileProgress {
  /** Path to the file that was processed */
  filePath: string;
  /** Current file number (1-indexed) */
  currentFile: number;
  /** Total number of files to process */
  totalFiles: number;
  /** Number of messages with context generated in this file */
  messagesGenerated: number;
  /** Total messages with context generated so far */
  totalMessagesGenerated: number;
}

export interface ContextGenerationOptions {
  /** Root directory for resolving source file paths */
  projectRoot: string;
  /** Absolute path to idioma directory (for extracting line numbers) */
  idiomaDir?: string;
  /** Catalog to generate context for */
  catalog: Catalog;
  /** Context provider to use */
  provider: ContextProvider;
  /** Lookup for actual source text (key -> text, for hash-based key systems) */
  sourceTextByKey?: Map<string, string>;
  /** Called when we know how many files need context generation */
  onFileCountKnown?: (count: number) => void;
  /** Called when starting to process a file (filePath, currentFile 1-indexed, totalFiles) */
  onFileStart?: (
    filePath: string,
    currentFile: number,
    totalFiles: number,
  ) => void;
  /** Called when a file is done processing */
  onFileComplete?: (progress: ContextFileProgress) => void;
}

export interface ContextGenerationResult {
  /** Number of messages that had context generated */
  generated: number;
  /** Number of messages skipped (already have context) */
  skipped: number;
  /** List of source files that couldn't be read */
  failedFiles: string[];
}

/**
 * Generate AI context for all messages in a catalog that need it.
 * Groups messages by source file and processes each file once for efficiency.
 */
export async function generateContextForCatalog(
  options: ContextGenerationOptions,
): Promise<ContextGenerationResult> {
  const {
    projectRoot,
    idiomaDir,
    catalog,
    provider,
    sourceTextByKey,
    onFileCountKnown,
    onFileStart,
    onFileComplete,
  } = options;

  const result: ContextGenerationResult = {
    generated: 0,
    skipped: 0,
    failedFiles: [],
  };

  // Count messages that don't need context generation
  for (const [, message] of catalog.messages) {
    if (!needsContextGeneration(message)) {
      result.skipped++;
    }
  }

  // Group messages by source file
  const messagesByFile = groupMessagesByFile(catalog.messages, sourceTextByKey);

  // Notify about file count
  const totalFiles = messagesByFile.size;
  onFileCountKnown?.(totalFiles);

  // Process each file
  let currentFile = 0;
  for (const [filePath, messages] of messagesByFile) {
    currentFile++;
    onFileStart?.(filePath, currentFile, totalFiles);

    // Try to read the source file
    const fullPath = join(projectRoot, filePath);
    let fileContent: string;

    try {
      fileContent = await readFile(fullPath, 'utf-8');
    } catch {
      // Silently skip files that can't be read
      result.failedFiles.push(filePath);
      continue;
    }

    // Skip empty files
    if (!fileContent.trim()) {
      result.failedFiles.push(filePath);
      continue;
    }

    // Update messages with accurate line numbers if idiomaDir is provided
    let messagesWithLines = messages;
    if (idiomaDir) {
      // Extract from this file to get accurate line numbers
      // (PO references are file-only, so we re-extract for line info)
      const extractedMessages = await extractFromFile(
        fileContent,
        fullPath,
        filePath,
        idiomaDir,
      );

      // Build a lookup map from key -> line number
      const lineByKey = new Map(extractedMessages.map((m) => [m.key, m.line]));

      // Update messages with accurate line numbers
      messagesWithLines = messages.map((m) => ({
        ...m,
        line: lineByKey.get(m.key) ?? m.line,
      }));
    }

    // Generate context for all messages in this file
    const contexts = await provider.generateContext({
      filePath,
      fileContent,
      messages: messagesWithLines,
    });

    // Apply generated contexts to catalog messages
    let messagesGenerated = 0;
    for (const ctx of contexts) {
      const message = catalog.messages.get(ctx.key);
      if (message) {
        addAIContext(message, ctx.context);
        result.generated++;
        messagesGenerated++;
      }
    }

    // Notify about file completion
    onFileComplete?.({
      filePath,
      currentFile,
      totalFiles,
      messagesGenerated,
      totalMessagesGenerated: result.generated,
    });
  }

  return result;
}
