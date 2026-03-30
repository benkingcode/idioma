import { createFileRoute, Link } from '@tanstack/react-router';
import { useLocale } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/stress-test')({
  component: StressTestPage,
});

function StressTestPage() {
  const locale = useLocale();

  return (
    <div data-testid="stress-test-page">
      <h1>Routing Stress Tests</h1>
      <p data-testid="stress-test-locale">Current locale: {locale}</p>

      <section data-testid="static-segments-section">
        <h2>Multiple Static Segments</h2>
        <ul>
          <li>
            <Link
              to="/{-$locale}/products/featured"
              params={{ locale }}
              data-testid="link-products-featured"
            >
              Products Featured
            </Link>
          </li>
          <li>
            <Link
              to="/{-$locale}/docs/api/v2/reference"
              params={{ locale }}
              data-testid="link-docs-reference"
            >
              Docs API v2 Reference
            </Link>
          </li>
        </ul>
      </section>

      <section data-testid="dynamic-params-section">
        <h2>Dynamic Params (should NOT translate values)</h2>

        <h3>Param value = "about" (matches translated segment)</h3>
        <Link
          to="/{-$locale}/users/$userId"
          params={{ locale, userId: 'about' }}
          data-testid="link-user-about"
        >
          User "about"
        </Link>
        <span data-testid="expected-user-about">
          Expected: {locale === 'es' ? '/es/users/about' : '/users/about'}
        </span>

        <h3>Param value = "blog" (matches another translated segment)</h3>
        <Link
          to="/{-$locale}/users/$userId"
          params={{ locale, userId: 'blog' }}
          data-testid="link-user-blog"
        >
          User "blog"
        </Link>
        <span data-testid="expected-user-blog">
          Expected: {locale === 'es' ? '/es/users/blog' : '/users/blog'}
        </span>

        <h3>Param value = "sobre" (is a Spanish word)</h3>
        <Link
          to="/{-$locale}/users/$userId"
          params={{ locale, userId: 'sobre' }}
          data-testid="link-user-sobre"
        >
          User "sobre"
        </Link>
        <span data-testid="expected-user-sobre">
          Expected: {locale === 'es' ? '/es/users/sobre' : '/users/sobre'}
        </span>
      </section>

      <section data-testid="multiple-dynamics-section">
        <h2>Multiple Dynamic Params</h2>

        <h3>Two params: /users/john/posts/first</h3>
        <Link
          to="/{-$locale}/users/$userId/posts/$postId"
          params={{ locale, userId: 'john', postId: 'first' }}
          data-testid="link-user-post-normal"
        >
          John's First Post
        </Link>

        <h3>Param = segment name: /users/about/posts/blog</h3>
        <Link
          to="/{-$locale}/users/$userId/posts/$postId"
          params={{ locale, userId: 'about', postId: 'blog' }}
          data-testid="link-user-post-tricky"
        >
          "about" user's "blog" post
        </Link>
        <span data-testid="expected-tricky-path">
          Expected:{' '}
          {locale === 'es'
            ? '/es/users/about/posts/blog'
            : '/users/about/posts/blog'}
        </span>
      </section>

      <section data-testid="consecutive-dynamics-section">
        <h2>Consecutive Dynamic Params</h2>

        <h3>/shop/electronics/laptop-123</h3>
        <Link
          to="/{-$locale}/shop/$category/$productId"
          params={{ locale, category: 'electronics', productId: 'laptop-123' }}
          data-testid="link-shop-normal"
        >
          Electronics Laptop
        </Link>

        <h3>/shop/about/contact (params match segment names)</h3>
        <Link
          to="/{-$locale}/shop/$category/$productId"
          params={{ locale, category: 'about', productId: 'contact' }}
          data-testid="link-shop-tricky"
        >
          Category "about", Product "contact"
        </Link>
        <span data-testid="expected-shop-tricky">
          Expected:{' '}
          {locale === 'es' ? '/es/shop/about/contact' : '/shop/about/contact'}
        </span>
      </section>
    </div>
  );
}
