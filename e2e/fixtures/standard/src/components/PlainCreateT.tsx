import { useState } from 'react';
import { useLocale } from '../idioma';
import { createT, type Locale } from '../idioma/plain';

/**
 * createT outside a hook's own rendering path: the same API that server
 * functions and emails use. Its plural is compiled to a function, which
 * createT has to call with the values.
 */
export function PlainCreateT() {
  const locale = useLocale() as Locale;
  const [count, setCount] = useState(1);
  const t = createT(locale);

  return (
    <div>
      <p data-testid="createt-plural">
        {t({ id: 'createT.daysLeft', values: { count } })}
      </p>
      <button
        data-testid="createt-increment"
        onClick={() => setCount((c) => c + 1)}
      >
        +
      </button>
    </div>
  );
}
