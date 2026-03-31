import { Trans } from '../idioma';

function Link({ children }: { children?: React.ReactNode }) {
  return (
    <a href="#" data-testid="intrinsic-link">
      {children}
    </a>
  );
}

export function IntrinsicElements() {
  return (
    <div>
      {/* Intrinsic HTML element inside Trans */}
      <p data-testid="intrinsic-span">
        <Trans id="intrinsic.span">
          We charge a 10% fee <span>(£1 minimum)</span> per ticket
        </Trans>
      </p>

      {/* Mix of custom component and intrinsic element */}
      <p data-testid="intrinsic-mixed">
        <Trans id="intrinsic.mixed">
          Click <Link>here</Link> or <span>there</span>
        </Trans>
      </p>
    </div>
  );
}
