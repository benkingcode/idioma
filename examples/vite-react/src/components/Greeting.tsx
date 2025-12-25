import { Trans } from '../idioma';

interface GreetingProps {
  name: string;
}

export function Greeting({ name }: GreetingProps) {
  return (
    <p>
      <Trans>Hello, {name}!</Trans>
    </p>
  );
}
