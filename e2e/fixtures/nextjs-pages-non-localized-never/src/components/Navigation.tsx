import { useLocale } from '@/idiomi/client';
import { Link } from '@/idiomi/client';
import type { Locale } from '@/idiomi';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

function setLocaleCookie(locale: string) {
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

export function Navigation() {
  const locale = useLocale();
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleLocaleSwitch = (newLocale: Locale) => {
    setLocaleCookie(newLocale);
    // Use Next.js router to switch locale
    router.push(router.asPath, router.asPath, { locale: newLocale });
  };

  return (
    <nav data-hydrated={isHydrated ? 'true' : 'false'}>
      <ul>
        <li>
          <Link href="/" data-testid="nav-home">
            Home
          </Link>
        </li>
        <li>
          <Link href="/about" data-testid="nav-about">
            About
          </Link>
        </li>
        <li>
          <Link href="/blog" data-testid="nav-blog">
            Blog
          </Link>
        </li>
        <li>
          <Link href="/contact" data-testid="nav-contact">
            Contact
          </Link>
        </li>
      </ul>

      <div data-testid="locale-switcher">
        <button
          data-testid="locale-en"
          onClick={() => handleLocaleSwitch('en')}
          aria-pressed={locale === 'en'}
        >
          English
        </button>
        <button
          data-testid="locale-es"
          onClick={() => handleLocaleSwitch('es')}
          aria-pressed={locale === 'es'}
        >
          Español
        </button>
      </div>

      <span data-testid="current-locale">{locale}</span>
    </nav>
  );
}
