import { plural } from '@idiomi/core/icu';
import { useState } from 'react';
import { Trans } from '../idiomi';

export function Plurals() {
  const [count, setCount] = useState(0);

  return (
    <div>
      {/* Basic one/other plural */}
      <p data-testid="plural-basic">
        <Trans>
          You have {plural(count, { one: '# item', other: '# items' })}
        </Trans>
      </p>

      {/* With zero form */}
      <p data-testid="plural-zero">
        <Trans>
          {plural(count, {
            zero: 'No messages',
            one: '# message',
            other: '# messages',
          })}
        </Trans>
      </p>

      {/* Plural with text around it */}
      <p data-testid="plural-surrounded">
        <Trans>
          There {plural(count, { one: 'is # apple', other: 'are # apples' })} in
          the basket
        </Trans>
      </p>

      {/* Arabic-style plural (tests all forms) */}
      <p data-testid="plural-cldr">
        <Trans>
          {plural(count, {
            zero: '# files (zero)',
            one: '# file (one)',
            two: '# files (two)',
            few: '# files (few)',
            many: '# files (many)',
            other: '# files (other)',
          })}
        </Trans>
      </p>

      {/* Counter controls */}
      <div style={{ marginTop: '1rem' }}>
        <button
          data-testid="plural-decrement"
          onClick={() => setCount((c) => Math.max(0, c - 1))}
        >
          -
        </button>
        <span data-testid="plural-count" style={{ margin: '0 1rem' }}>
          {count}
        </span>
        <button
          data-testid="plural-increment"
          onClick={() => setCount((c) => c + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
