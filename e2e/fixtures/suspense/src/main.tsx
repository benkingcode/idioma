import { StrictMode, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { IdiomaProvider } from './idioma';

function Root() {
  const [locale, setLocale] = useState('en');

  return (
    <StrictMode>
      <IdiomaProvider locale={locale}>
        {/* Suspense boundary for lazy-loaded translations */}
        <Suspense
          fallback={
            <div data-testid="suspense-fallback">Loading translations...</div>
          }
        >
          <App locale={locale} onLocaleChange={setLocale} />
        </Suspense>
      </IdiomaProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
