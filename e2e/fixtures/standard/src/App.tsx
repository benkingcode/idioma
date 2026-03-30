import { BasicTrans } from './components/BasicTrans';
import { ComponentTags } from './components/ComponentTags';
import { EdgeCases } from './components/EdgeCases';
import { Interpolation } from './components/Interpolation';
import { Plurals } from './components/Plurals';
import { UseT } from './components/UseT';

interface AppProps {
  locale: string;
  onLocaleChange: (locale: string) => void;
}

export default function App({ locale, onLocaleChange }: AppProps) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Idiomi E2E Test Fixture</h1>
        <div>
          <label>
            Locale:{' '}
            <select
              data-testid="locale-selector"
              value={locale}
              onChange={(e) => onLocaleChange(e.target.value)}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="ar">العربية</option>
            </select>
          </label>
          <span
            data-testid="current-locale"
            style={{ marginLeft: '1rem', fontWeight: 'bold' }}
          >
            {locale}
          </span>
        </div>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <section data-testid="basic-section">
          <h2>Basic Trans</h2>
          <BasicTrans />
        </section>

        <section data-testid="interpolation-section">
          <h2>Interpolation</h2>
          <Interpolation />
        </section>

        <section data-testid="plurals-section">
          <h2>Plurals</h2>
          <Plurals />
        </section>

        <section data-testid="component-tags-section">
          <h2>Component Tags</h2>
          <ComponentTags />
        </section>

        <section data-testid="usetT-section">
          <h2>useT Hook</h2>
          <UseT />
        </section>

        <section data-testid="edge-cases-section">
          <h2>Edge Cases</h2>
          <EdgeCases />
        </section>
      </main>
    </div>
  );
}
