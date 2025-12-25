import { useT } from '../idioma';

export function UseT() {
  const t = useT();

  // Simple message - will be extracted with hash key
  const greeting = t('Hello from useT!');

  // Message with interpolation
  const withName = t('Welcome, {name}!', { name: 'Developer' });

  // Multiple placeholders
  const withMultiple = t('{count} items by {author}', {
    count: 42,
    author: 'Admin',
  });

  return (
    <div>
      {/* Simple useT */}
      <p data-testid="uset-simple">{greeting}</p>

      {/* useT with interpolation */}
      <p data-testid="uset-interpolation">{withName}</p>

      {/* useT with multiple values */}
      <p data-testid="uset-multiple">{withMultiple}</p>

      {/* Inline useT call */}
      <p data-testid="uset-inline">{t('Inline translation')}</p>
    </div>
  );
}
