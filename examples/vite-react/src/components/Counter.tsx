import { useState } from 'react';
import { Trans } from '../idioma';

export function Counter() {
  const [count, setCount] = useState(1);
  const itemLabel = count === 1 ? 'item' : 'items';

  return (
    <div>
      <p>
        <Trans>
          You have {count} {itemLabel} in your cart.
        </Trans>
      </p>
      <button onClick={() => setCount((c) => Math.max(0, c - 1))}>-</button>
      <span style={{ margin: '0 1rem' }}>{count}</span>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
    </div>
  );
}
