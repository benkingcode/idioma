import { createFileRoute, Link } from '@tanstack/react-router';
import { Trans, useLocale } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/products/featured')({
  component: FeaturedProducts,
});

function FeaturedProducts() {
  const locale = useLocale();

  return (
    <div data-testid="featured-products-page">
      <h1 data-testid="featured-products-title">
        <Trans>Featured Products</Trans>
      </h1>
      <ul data-testid="featured-products-list">
        <li>
          <Link
            to="/{-$locale}/shop/$category/$productId"
            params={{ locale, category: 'electronics', productId: 'laptop-1' }}
            data-testid="product-link-laptop"
          >
            Laptop
          </Link>
        </li>
        <li>
          <Link
            to="/{-$locale}/shop/$category/$productId"
            params={{ locale, category: 'clothing', productId: 'shirt-1' }}
            data-testid="product-link-shirt"
          >
            Shirt
          </Link>
        </li>
      </ul>
    </div>
  );
}
