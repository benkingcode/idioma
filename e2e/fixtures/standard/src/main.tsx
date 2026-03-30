import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { IdiomiProvider } from './idiomi';

function Root() {
  const [locale, setLocale] = useState('en');

  return (
    <StrictMode>
      <IdiomiProvider locale={locale}>
        <App locale={locale} onLocaleChange={setLocale} />
      </IdiomiProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
