import { useT } from '../idioma';

export function UseTObjectForm() {
  const t = useT();

  return (
    <div>
      {/* Object form with id only (no source) */}
      <p data-testid="uset-obj-id-only">{t({ id: 'uset.idOnly' })}</p>

      {/* Object form with id + source */}
      <p data-testid="uset-obj-with-source">
        {t({ id: 'uset.greeting', source: 'Hello from object form!' })}
      </p>

      {/* Object form with id + source + values */}
      <p data-testid="uset-obj-with-values">
        {t({
          id: 'uset.welcome',
          source: 'Welcome, {name}!',
          values: { name: 'Tester' },
        })}
      </p>
    </div>
  );
}
