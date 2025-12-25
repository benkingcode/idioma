import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { IdiomaProvider } from './idioma';

function Root() {
  const [locale, setLocale] = useState('en');

  return (
    <StrictMode>
      <IdiomaProvider locale={locale}>
        <App locale={locale} onLocaleChange={setLocale} />
      </IdiomaProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
