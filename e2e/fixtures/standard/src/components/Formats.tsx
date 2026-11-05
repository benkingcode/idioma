import { useT } from '../idioma';

// A fixed date, so the expected text can be computed in the test
const DAY = new Date(2026, 10, 5, 21, 30);

/**
 * ICU number, date and time arguments, formatted with Intl at runtime from
 * options the compiler worked out at build time.
 */
export function Formats() {
  const t = useT();

  return (
    <div>
      <p data-testid="format-currency">
        {t({
          id: 'formats.total',
          source: 'Total: {price, number, ::currency/EUR}',
          values: { price: 1234.5 },
        })}
      </p>
      <p data-testid="format-date">
        {t({
          id: 'formats.when',
          source: 'On {day, date, long}',
          values: { day: DAY },
        })}
      </p>
      <p data-testid="format-pound">
        {t({
          id: 'formats.tickets',
          source: '{count, plural, one {# ticket} other {# tickets}}',
          values: { count: 1200 },
        })}
      </p>
    </div>
  );
}
