import { useT } from '../idioma';

export function Messages() {
  const t = useT();

  const greeting = t('Welcome back!');
  const itemCount = t('You have {count} notifications.', { count: 5 });

  return (
    <div>
      <p>{greeting}</p>
      <p>{itemCount}</p>
    </div>
  );
}
