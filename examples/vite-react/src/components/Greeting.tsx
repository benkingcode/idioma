import { Trans } from '../idiomi';

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
