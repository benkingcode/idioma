import type { AiPackage } from '@idioma/core/internal';
import { runTranslateCommand } from './translate.js';

/**
 * @idioma/ai: AI translation for Idioma.
 *
 * Install it with the AI SDK and a provider to use `idioma translate`:
 * `pnpm add -D @idioma/ai ai@6 @ai-sdk/anthropic@3`. Core's CLI finds it
 * in the project and calls it; nothing else in Idioma loads it.
 */
export { runTranslateCommand };
export {
  defineConfig,
  readAiConfig,
  type AiConfig,
  type IdiomaConfig,
  type LanguageModel,
  type ProviderOptions,
} from './config.js';

// What core's CLI calls. The typecheck fails here if the two drift apart.
({ runTranslateCommand }) satisfies AiPackage;
