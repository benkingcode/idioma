import { parseSync, type JSXElement } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { serializeJsxChildren, type SerializeResult } from './serialize';
import { transformModule } from './transform';

// The Babel serializer's cases, run on the Oxc serializer. Only this helper
// changed: it parses with Oxc and finds the first JSX element.
function serialize(code: string): SerializeResult {
  const { program } = parseSync('test.tsx', code, {
    lang: 'tsx',
    preserveParens: false,
  });
  let found: JSXElement | null = null;
  const visit = (node: unknown): void => {
    if (found || !node || typeof node !== 'object') return;
    if ((node as { type?: string }).type === 'JSXElement') {
      found = node as JSXElement;
      return;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  };
  visit(program);
  if (!found) throw new Error('No JSX element found');
  return serializeJsxChildren((found as JSXElement).children, code);
}

describe('serializeJsxChildren', () => {
  it('serializes simple text', () => {
    const result = serialize('<Trans>Hello world</Trans>');

    expect(result.message).toBe('Hello world');
    expect(result.placeholders).toEqual({});
    expect(result.components).toEqual([]);
  });

  it('serializes text with simple identifier placeholder', () => {
    const result = serialize('<Trans>Hello {name}</Trans>');

    expect(result.message).toBe('Hello {name}');
    expect(result.placeholders).toEqual({ name: 'name' });
  });

  it('serializes text with member expression placeholder', () => {
    const result = serialize('<Trans>Hello {user.name}</Trans>');

    expect(result.message).toBe('Hello {user.name}');
    expect(result.placeholders).toEqual({ 'user.name': 'user.name' });
  });

  it('serializes complex expression as numbered placeholder', () => {
    const result = serialize('<Trans>Count: {getCount()}</Trans>');

    expect(result.message).toBe('Count: {0}');
    expect(result.placeholders).toEqual({ '0': 'getCount()' });
    expect(result.comments).toContain('{0} = getCount()');
  });

  it('serializes JSX element with named tag', () => {
    const result = serialize(
      '<Trans>Click <Link>here</Link> to continue</Trans>',
    );

    expect(result.message).toBe('Click <Link>here</Link> to continue');
    expect(result.components).toEqual(['Link']);
  });

  it('serializes multiple JSX elements with named tags', () => {
    const result = serialize(
      '<Trans><Bold>Hello</Bold> and <Italic>world</Italic></Trans>',
    );

    expect(result.message).toBe(
      '<Bold>Hello</Bold> and <Italic>world</Italic>',
    );
    expect(result.components).toEqual(['Bold', 'Italic']);
  });

  it('serializes self-closing JSX element with named tag', () => {
    const result = serialize('<Trans>Line break<br/>here</Trans>');

    expect(result.message).toBe('Line break<br/>here');
    expect(result.components).toEqual(['br']);
  });

  it('serializes nested JSX elements with named tags', () => {
    const result = serialize(
      '<Trans><Bold><Italic>text</Italic></Bold></Trans>',
    );

    expect(result.message).toBe('<Bold><Italic>text</Italic></Bold>');
    expect(result.components).toEqual(['Bold', 'Italic']);
  });

  it('serializes placeholders inside JSX elements', () => {
    const result = serialize('<Trans><Link>Hello {name}</Link></Trans>');

    expect(result.message).toBe('<Link>Hello {name}</Link>');
    expect(result.placeholders).toEqual({ name: 'name' });
    expect(result.components).toEqual(['Link']);
  });

  it('handles duplicate component names', () => {
    const result = serialize(
      '<Trans>Click <Link>here</Link> or <Link>there</Link></Trans>',
    );

    // Both Links use the same tag name - runtime tracks order
    expect(result.message).toBe(
      'Click <Link>here</Link> or <Link>there</Link>',
    );
    expect(result.components).toEqual(['Link', 'Link']);
  });

  it('handles multiple numbered placeholders', () => {
    const result = serialize('<Trans>Results: {fn1()} and {fn2()}</Trans>');

    expect(result.message).toBe('Results: {0} and {1}');
    expect(result.placeholders['0']).toBe('fn1()');
    expect(result.placeholders['1']).toBe('fn2()');
  });

  it('trims and normalizes whitespace', () => {
    const result = serialize(`<Trans>
      Hello   world
    </Trans>`);

    expect(result.message).toBe('Hello world');
  });

  it('handles empty Trans', () => {
    const result = serialize('<Trans></Trans>');

    expect(result.message).toBe('');
  });

  it('handles JSX fragment children', () => {
    const result = serialize('<Trans><>fragment content</></Trans>');

    // Fragment content should be flattened
    expect(result.message).toBe('fragment content');
  });

  it('does not create placeholder for whitespace between text and component (issue #5)', () => {
    const result = serialize(
      '<Trans>Promote your next club night with <Text>Dancefloor Pro</Text>, the all-in-one platform.</Trans>',
    );

    // Space between "with" and <Text> should be literal, not {0}
    expect(result.message).toBe(
      'Promote your next club night with <Text>Dancefloor Pro</Text>, the all-in-one platform.',
    );
    expect(result.placeholders).toEqual({});
  });

  it('inlines {" "} expression as literal space, not placeholder (issue #5)', () => {
    const result = serialize(
      `<Trans>Promote your next club night with{' '}<Text>Dancefloor Pro</Text>, the all-in-one platform.</Trans>`,
    );

    // {' '} should become a literal space, not {0}
    expect(result.message).toBe(
      'Promote your next club night with <Text>Dancefloor Pro</Text>, the all-in-one platform.',
    );
    expect(result.placeholders).toEqual({});
  });

  it('inlines {" "} in multiline Trans with components (issue #5 exact reproduction)', () => {
    // Exact formatting from benkingcode/dancefloor-mono PR #320
    const result = serialize(`<Trans id="promotersPage.hero.subtitle">
                Go beyond just selling tickets. Promote your next club night
                with{' '}
                <Text
                  size="inherit"
                  component="span"
                  fw={500}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Dancefloor Pro
                </Text>
                , the all-in-one ticketing and marketing platform built for
                dance music. Reach the right audience, build your community, and
                reward your superfans.
              </Trans>`);

    expect(result.message).not.toContain('{0}');
    expect(result.message).toBe(
      'Go beyond just selling tickets. Promote your next club night with <Text>Dancefloor Pro</Text>, the all-in-one ticketing and marketing platform built for dance music. Reach the right audience, build your community, and reward your superfans.',
    );
    expect(result.placeholders).toEqual({});
  });

  it('trims whitespace inside multiline component tags', () => {
    const result = serialize(`<Trans>
      <Text>
        Dancefloor Pro
      </Text>
    </Trans>`);

    expect(result.message).toBe('<Text>Dancefloor Pro</Text>');
  });

  it('handles component with explicit whitespace and punctuation', () => {
    // Matches the reproduction case from GitHub issue #4
    const result = serialize(`<Trans>
  Promote your next club night with{' '}
  <Text>Dancefloor Pro</Text>, the all-in-one
  ticketing platform.
</Trans>`);

    expect(result.message).toBe(
      'Promote your next club night with <Text>Dancefloor Pro</Text>, the all-in-one ticketing platform.',
    );
  });

  it('handles expression containers adjacent to multiline components', () => {
    const result = serialize(`<Trans>
      Built with{' '}
      <span>
        open source
      </span>{' '}
      tools
    </Trans>`);

    // {' '} string literals become inline spaces (not placeholders)
    expect(result.message).toBe('Built with <span>open source</span> tools');
  });

  it('handles nested multiline components', () => {
    const result = serialize(`<Trans>
      <Bold>
        Important: <Italic>read carefully</Italic>
      </Bold>
    </Trans>`);

    expect(result.message).toBe(
      '<Bold>Important: <Italic>read carefully</Italic></Bold>',
    );
  });
});

describe('serializeJsxChildren with plural()', () => {
  it('serializes plural() call to ICU format', () => {
    const result = serialize(
      '<Trans>You have {plural(count, { one: "# item", other: "# items" })} in cart</Trans>',
    );

    expect(result.message).toBe(
      'You have {count, plural, one {# item} other {# items}} in cart',
    );
    // The variable should be tracked in placeholders
    expect(result.placeholders).toEqual({ count: 'count' });
  });

  it('serializes plural() with all CLDR forms', () => {
    const result = serialize(`
      <Trans>
        {plural(n, {
          zero: "none",
          one: "one",
          two: "two",
          few: "few",
          many: "many",
          other: "other"
        })}
      </Trans>
    `);

    expect(result.message).toBe(
      '{n, plural, zero {none} one {one} two {two} few {few} many {many} other {other}}',
    );
    expect(result.placeholders).toEqual({ n: 'n' });
  });

  it('handles plural() alongside regular placeholders', () => {
    const result = serialize(
      '<Trans>Hello {name}, you have {plural(count, { one: "# message", other: "# messages" })}</Trans>',
    );

    expect(result.message).toBe(
      'Hello {name}, you have {count, plural, one {# message} other {# messages}}',
    );
    expect(result.placeholders).toEqual({
      name: 'name',
      count: 'count',
    });
  });

  it('handles plural() with member expression value', () => {
    const result = serialize(
      '<Trans>Items: {plural(data.count, { one: "#", other: "#" })}</Trans>',
    );

    expect(result.message).toBe(
      'Items: {data.count, plural, one {#} other {#}}',
    );
    // Member expressions use the full path as key
    expect(result.placeholders).toEqual({ 'data.count': 'data.count' });
  });

  it('handles plural() inside JSX elements', () => {
    const result = serialize(
      '<Trans><span>{plural(count, { one: "# item", other: "# items" })}</span></Trans>',
    );

    expect(result.message).toBe(
      '<span>{count, plural, one {# item} other {# items}}</span>',
    );
    expect(result.components).toEqual(['span']);
    expect(result.placeholders).toEqual({ count: 'count' });
  });

  it('escapes ICU special chars in plural forms', () => {
    const result = serialize(
      '<Trans>{plural(count, { one: "{count} item", other: "{count} items" })}</Trans>',
    );

    // Curly braces should be escaped in ICU
    expect(result.message).toContain("one {'{count}' item}");
  });
});

describe('serializeJsxChildren componentNodes', () => {
  it('stores componentNodes parallel to components', () => {
    const result = serialize(
      '<Trans>Click <Link>here</Link> or <Bold>this</Bold></Trans>',
    );

    expect(result.componentNodes).toHaveLength(2);
    expect(result.components).toEqual(['Link', 'Bold']);
  });

  it('preserves JSX attributes on componentNodes', () => {
    const result = serialize(
      '<Trans>Style <Text size="inherit" fw={500}>content</Text> here</Trans>',
    );

    // The element as written; the transform writes it self-closing (below)
    expect(result.componentNodes).toHaveLength(1);
    const node = result.componentNodes[0]!;
    expect(node.openingElement.attributes).toHaveLength(2);
  });

  it('preserves attributes on intrinsic elements', () => {
    const result = serialize(
      '<Trans>Go <span style={{ fontWeight: 500 }}>bold</span></Trans>',
    );

    expect(result.componentNodes).toHaveLength(1);
    const node = result.componentNodes[0]!;
    expect(node.openingElement.attributes).toHaveLength(1);
    // Name should be span
    expect(
      node.openingElement.name.type === 'JSXIdentifier' &&
        node.openingElement.name.name,
    ).toBe('span');
  });

  it('writes a component with children self-closing, attributes kept', () => {
    const code = `
      import { Trans } from './idioma';
      export const A = () => <Trans><Link href="/test">click me</Link></Trans>;
    `;
    const { code: output } = transformModule(code, '/project/src/A.tsx', {
      idiomaDir: '/project/src/idioma',
    });

    expect(output).toContain('__c={[<Link href="/test" />]}');
    expect(output).toContain('__cn={["Link"]}');
  });

  it('handles self-closing JSX elements', () => {
    const result = serialize('<Trans>Line<br/>break</Trans>');

    expect(result.componentNodes).toHaveLength(1);
    expect(result.componentNodes[0]!.openingElement.selfClosing).toBe(true);
  });

  it('returns empty componentNodes when no components', () => {
    const result = serialize('<Trans>Hello {name}</Trans>');

    expect(result.componentNodes).toEqual([]);
  });
});
