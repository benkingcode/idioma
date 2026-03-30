import { createFileRoute } from '@tanstack/react-router';
import { Trans, useT } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/shop/$category/$productId')({
  component: ProductPage,
});

function ProductPage() {
  const { category, productId } = Route.useParams();
  const t = useT();

  return (
    <div data-testid="product-page">
      <h1 data-testid="product-title">
        <Trans>Product Details</Trans>
      </h1>
      <p data-testid="product-category">{category}</p>
      <p data-testid="product-id">{productId}</p>
      <p data-testid="product-description">
        {t('Product {productId} in category {category}', {
          productId,
          category,
        })}
      </p>
    </div>
  );
}
