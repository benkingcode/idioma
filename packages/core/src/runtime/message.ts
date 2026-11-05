/**
 * The message to show for a locale, from one key's compiled messages: the
 * locale itself, then its base locales one subtag at a time (es-MX, then es),
 * then the default locale. Undefined when none of them has the message, so
 * the caller can fall back to the source text or the id.
 *
 * It never picks some other locale's message. It used to take the first
 * one in the object, so a key with no source-locale text rendered, say,
 * Catalan on English pages (issue #8).
 *
 * @internal Used by @idioma/react and the plain createT.
 */
export function _pickMessage<M>(
  messages: Record<string, M> | undefined,
  locale: string,
  defaultLocale: string | undefined,
): M | undefined {
  if (!messages) return undefined;
  let candidate = locale;
  for (;;) {
    const message = own(messages, candidate);
    if (message !== undefined) return message;
    const cut = Math.max(
      candidate.lastIndexOf('-'),
      candidate.lastIndexOf('_'),
    );
    if (cut <= 0) break;
    candidate = candidate.slice(0, cut);
  }
  return defaultLocale ? own(messages, defaultLocale) : undefined;
}

/** A locale's own entry: never `__source` or anything inherited. */
function own<M>(messages: Record<string, M>, locale: string): M | undefined {
  if (locale.startsWith('__')) return undefined;
  return Object.prototype.hasOwnProperty.call(messages, locale)
    ? messages[locale]
    : undefined;
}
