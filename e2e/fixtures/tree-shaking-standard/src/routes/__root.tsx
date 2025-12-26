import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { useState } from 'react';
import { IdiomaProvider } from '../idioma';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const [locale, setLocale] = useState<'en' | 'es'>('en');

  return (
    <IdiomaProvider locale={locale}>
      <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <nav
          data-testid="navigation"
          style={{
            marginBottom: '20px',
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          <Link to="/" data-testid="nav-home">
            Home
          </Link>
          <Link to="/about" data-testid="nav-about">
            About
          </Link>
          <Link to="/contact" data-testid="nav-contact">
            Contact
          </Link>
          <select
            data-testid="locale-selector"
            value={locale}
            onChange={(e) => setLocale(e.target.value as 'en' | 'es')}
            style={{ marginLeft: 'auto' }}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </nav>
        <Outlet />
      </div>
    </IdiomaProvider>
  );
}
