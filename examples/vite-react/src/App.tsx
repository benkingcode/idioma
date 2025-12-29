import { Counter } from './components/Counter';
import { Greeting } from './components/Greeting';
import { Messages } from './components/Messages';
import { Trans } from './idiomi';

interface AppProps {
  locale: string;
  onLocaleChange: (locale: string) => void;
}

export default function App({ locale, onLocaleChange }: AppProps) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>
          <Trans>Idiomi Example</Trans>
        </h1>
        <label>
          <Trans>Language</Trans>:{' '}
          <select
            value={locale}
            onChange={(e) => onLocaleChange(e.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <section>
          <h2>
            <Trans>Interpolation</Trans>
          </h2>
          <Greeting name="World" />
        </section>

        <section>
          <h2>
            <Trans>Pluralization</Trans>
          </h2>
          <Counter />
        </section>

        <section>
          <h2>
            <Trans>Imperative API</Trans>
          </h2>
          <Messages />
        </section>
      </main>
    </div>
  );
}
