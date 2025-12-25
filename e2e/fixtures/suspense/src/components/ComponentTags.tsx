import { Trans } from '../idioma';

// Test components for interpolation
function Link({ children }: { children?: React.ReactNode }) {
  return (
    <a href="#" data-testid="link">
      {children}
    </a>
  );
}

function Bold({ children }: { children?: React.ReactNode }) {
  return <strong data-testid="bold">{children}</strong>;
}

function Italic({ children }: { children?: React.ReactNode }) {
  return <em data-testid="italic">{children}</em>;
}

export function ComponentTags() {
  const name = 'World';

  return (
    <div>
      {/* Single component */}
      <p data-testid="comp-single">
        <Trans>
          Click <Link>here</Link> to continue
        </Trans>
      </p>

      {/* Multiple components */}
      <p data-testid="comp-multiple">
        <Trans>
          Read the <Link>terms</Link> and <Bold>privacy policy</Bold>
        </Trans>
      </p>

      {/* Component with placeholder inside */}
      <p data-testid="comp-with-placeholder">
        <Trans>
          Hello <Bold>{name}</Bold>!
        </Trans>
      </p>

      {/* Multiple components with text between */}
      <p data-testid="comp-mixed">
        <Trans>
          This is <Bold>bold</Bold>, this is <Italic>italic</Italic>, and normal
        </Trans>
      </p>

      {/* Nested components */}
      <p data-testid="comp-nested">
        <Trans>
          <Bold>
            Important: <Italic>read carefully</Italic>
          </Bold>
        </Trans>
      </p>
    </div>
  );
}
