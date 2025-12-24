import murmur from 'murmurhash-js';

// Base62 character set (0-9, A-Z, a-z)
const BASE62_CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Context separator (ASCII end-of-transmission character)
const CONTEXT_SEPARATOR = '\u0004';

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
 *
 * @param message - The message to generate a key for
 * @param context - Optional context (e.g., component name, domain)
 * @returns An 8-character base62 key
 *
 * @example
 * generateKey('Hello, world!')  // => 'k8Jf2mN4'
 * generateKey('Submit', 'button')  // => 'xY3pQ7wR'
 */
export function generateKey(message: string, context?: string): string {
  // Combine context and message if context is provided
  const input = context ? `${context}${CONTEXT_SEPARATOR}${message}` : message;

  // Generate 32-bit hash using murmurhash3
  const hash = murmur.murmur3(input);

  // Convert to base62
  const base62 = toBase62(hash);

  // Pad to 8 characters (max base62 for 32-bit is 6 chars, so we pad with leading zeros)
  return base62.padStart(8, '0').slice(-8);
}
