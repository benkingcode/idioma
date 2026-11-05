import type { ReactNode } from 'react';

/**
 * Another library's Trans in a folder whose name starts like the idioma
 * folder's. Idioma must leave it alone: a bare startsWith used to take
 * src/idioma-legacy for src/idioma and rewrite this into Idioma's Trans.
 */
export function Trans({ children }: { children: ReactNode }) {
  return <span data-testid="legacy-trans">[legacy] {children}</span>;
}
