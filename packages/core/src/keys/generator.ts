import murmur from 'murmurhash-js';

// Base62 character set (0-9, A-Z, a-z)
const BASE62_CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Context separator (ASCII end-of-transmission character)
const CONTEXT_SEPARATOR = '\u0004';

// Namespace separator (ASCII enquiry character)
const NAMESPACE_SEPARATOR = '\u0005';

/**
 * Encode a number to base62 string
 */
function toBase62(num: number): string {
  if (num === 0) return BASE62_CHARS[0]!;

  // Ensure we're working with unsigned 32-bit integer
  num = num >>> 0;

  let result = '';
  while (num > 0) {
    result = BASE62_CHARS[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return result;
}

/**
 * Generate a unique key for a message using murmurhash.
 *
 * The key is an 8-character base62 string derived from the hash of the message.
 * If a context is provided, it's prepended to the message with a separator.
 * If a namespace is provided, it's prepended to the entire string with a different separator.
 *
 * @param message - The message to generate a key for
 * @param context - Optional context (e.g., component name, domain)
 * @param namespace - Optional namespace for organizing translations
 * @returns An 8-character base62 key
 *
 * @example
 * generateKey('Hello, world!')  // => 'k8Jf2mN4'
 * generateKey('Submit', 'button')  // => 'xY3pQ7wR'
 * generateKey('Submit', undefined, 'auth')  // => different key
 * generateKey('Submit', 'button', 'auth')  // => different key with both
 */
export function generateKey(
  message: string,
  context?: string,
  namespace?: string,
): string {
  // Build input string with all components
  // Format: {namespace}\u0005{context}\u0004{message}
  let input = message;
  if (context) {
    input = `${context}${CONTEXT_SEPARATOR}${input}`;
  }
  if (namespace) {
    input = `${namespace}${NAMESPACE_SEPARATOR}${input}`;
  }

  // Generate 32-bit hash using murmurhash3
  const hash = murmur.murmur3(input);

  // Convert to base62
  const base62 = toBase62(hash);

  // Pad to 8 characters (max base62 for 32-bit is 6 chars, so we pad with leading zeros)
  return base62.padStart(8, '0').slice(-8);
}
