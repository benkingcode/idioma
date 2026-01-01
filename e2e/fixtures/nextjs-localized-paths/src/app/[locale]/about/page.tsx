export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div>
      <h1 data-testid="about-title">About Page</h1>
      <p data-testid="locale">Current locale: {locale}</p>
    </div>
  );
}
