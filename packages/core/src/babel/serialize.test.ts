import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';
import { serializeJsxChildren, type SerializeResult } from './serialize';

function parseJsx(code: string): t.JSXElement {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let jsxElement: t.JSXElement | null = null;

  traverse(ast, {
    JSXElement(path) {
      jsxElement = path.node;
      path.stop();
    },
  });

  if (!jsxElement) {
    throw new Error('No JSX element found');
  }

  return jsxElement;
}

function getChildren(code: string): t.JSXElement['children'] {
  return parseJsx(code).children;
}

describe('serializeJsxChildren', () => {
  it('serializes simple text', () => {
    const children = getChildren('<Trans>Hello world</Trans>');
    const result = serializeJsxChildren(children);

    expect(result.message).toBe('Hello world');
    expect(result.placeholders).toEqual({});
    expect(result.components).toEqual([]);
  });

  it('serializes text with simple identifier placeholder', () => {
    const children = getChildren('<Trans>Hello {name}</Trans>');
    const result = serializeJsxChildren(children);

    expect(result.message).toBe('Hello {name}');
    expect(result.placeholders).toEqual({ name: 'name' });
  });

  it('serializes text with member expression placeholder', () => {
    const children = getChildren('<Trans>Hello {user.name}</Trans>');
    const result = serializeJsxChildren(children);

    expect(result.message).toBe('Hello {user.name}');
    expect(result.placeholders).toEqual({ 'user.name': 'user.name' });
  });

  it('serializes complex expression as numbered placeholder', () => {
    const children = getChildren('<Trans>Count: {getCount()}</Trans>');
    const result = serializeJsxChildren(children);

    expect(result.message).toBe('Count: {0}');
    expect(result.placeholders).toEqual({ '0': 'getCount()' });
    expect(result.comments).toContain('{0} = getCount()');
  });

  it('serializes JSX element with named tag', () => {
    const children = getChildren(
      '<Trans>Click <Link>here</Link> to continue</Trans>',
    );
    const result = serializeJsxChildren(children);

    expect(result.message).toBe('Click <Link>here</Link> to continue');
    expect(result.components).toEqual(['Link']);
  });

  it('serializes multiple JSX elements with named tags', () => {
    const children = getChildren(
      '<Trans><Bold>Hello</Bold> and <Italic>world</Italic></Trans>',
    );
    const result = serializeJsxChildren(children);

    expect(result.message).toBe(
      '<Bold>Hello</Bold> and <Italic>world</Italic>',
    );
    expect(result.components).toEqual(['Bold', 'Italic']);
  });

  it('serializes self-closing JSX element with named tag', () => {
    const children = getChildren('<Trans>Line break<br/>here</Trans>');
    const result = serializeJsxChildren(children);

    expect(result.message).toBe('Line break<br/>here');
    expect(result.components).toEqual(['br']);
  });

  it('serializes nested JSX elements with named tags', () => {
    const children = getChildren(
      '<Trans><Bold><Italic>text</Italic></Bold></Trans>',
    );
    const result = serializeJsxChildren(children);

    expect(result.message).toBe('<Bold><Italic>text</Italic></Bold>');
    expect(result.components).toEqual(['Bold', 'Italic']);
  });

  it('serializes placeholders inside JSX elements', () => {
    const children = getChildren('<Trans><Link>Hello {name}</Link></Trans>');
    const result = serializeJsxChildren(children);

    expect(result.message).toBe('<Link>Hello {name}</Link>');
    expect(result.placeholders).toEqual({ name: 'name' });
    expect(result.components).toEqual(['Link']);
  });

  it('handles duplicate component names', () => {
    const children = getChildren(
      '<Trans>Click <Link>here</Link> or <Link>there</Link></Trans>',
    );
    const result = serializeJsxChildren(children);

    // Both Links use the same tag name - runtime tracks order
    expect(result.message).toBe(
      'Click <Link>here</Link> or <Link>there</Link>',
    );
    expect(result.components).toEqual(['Link', 'Link']);
  });

  it('handles multiple numbered placeholders', () => {
    const children = getChildren('<Trans>Results: {fn1()} and {fn2()}</Trans>');
    const result = serializeJsxChildren(children);

    expect(result.message).toBe('Results: {0} and {1}');
    expect(result.placeholders['0']).toBe('fn1()');
    expect(result.placeholders['1']).toBe('fn2()');
  });

  it('trims and normalizes whitespace', () => {
    const children = getChildren(`<Trans>
      Hello   world
    </Trans>`);
    const result = serializeJsxChildren(children);

    expect(result.message).toBe('Hello world');
  });

  it('handles empty Trans', () => {
    const children = getChildren('<Trans></Trans>');
    const result = serializeJsxChildren(children);

    expect(result.message).toBe('');
  });

  it('handles JSX fragment children', () => {
    const children = getChildren('<Trans><>fragment content</></Trans>');
    const result = serializeJsxChildren(children);

    // Fragment content should be flattened
    expect(result.message).toBe('fragment content');
  });

  it('does not create placeholder for whitespace between text and component (issue #5)', () => {
    const children = getChildren(
      '<Trans>Promote your next club night with <Text>Dancefloor Pro</Text>, the all-in-one platform.</Trans>',
    );
    const result = serializeJsxChildren(children);

    // Space between "with" and <Text> should be literal, not {0}
    expect(result.message).toBe(
      'Promote your next club night with <Text>Dancefloor Pro</Text>, the all-in-one platform.',
    );
    expect(result.placeholders).toEqual({});
  });

  it('inlines {" "} expression as literal space, not placeholder (issue #5)', () => {
    const children = getChildren(
      `<Trans>Promote your next club night with{' '}<Text>Dancefloor Pro</Text>, the all-in-one platform.</Trans>`,
    );
    const result = serializeJsxChildren(children);

    // {' '} should become a literal space, not {0}
    expect(result.message).toBe(
      'Promote your next club night with <Text>Dancefloor Pro</Text>, the all-in-one platform.',
    );
    expect(result.placeholders).toEqual({});
  });

  it('trims whitespace inside multiline component tags', () => {
    const children = getChildren(`<Trans>
      <Text>
        Dancefloor Pro
      </Text>
    </Trans>`);
    const result = serializeJsxChildren(children);

    expect(result.message).toBe('<Text>Dancefloor Pro</Text>');
  });

  it('handles component with explicit whitespace and punctuation', () => {
    // Matches the reproduction case from GitHub issue #4
    const children = getChildren(`<Trans>
  Promote your next club night with{' '}
  <Text>Dancefloor Pro</Text>, the all-in-one
  ticketing platform.
</Trans>`);
    const result = serializeJsxChildren(children);

    expect(result.message).toBe(
      'Promote your next club night with <Text>Dancefloor Pro</Text>, the all-in-one ticketing platform.',
    );
  });

  it('handles expression containers adjacent to multiline components', () => {
    const children = getChildren(`<Trans>
      Built with{' '}
      <span>
        open source
      </span>{' '}
      tools
    </Trans>`);
    const result = serializeJsxChildren(children);

    // {' '} string literals become inline spaces (not placeholders)
    expect(result.message).toBe('Built with <span>open source</span> tools');
  });

  it('handles nested multiline components', () => {
    const children = getChildren(`<Trans>
      <Bold>
        Important: <Italic>read carefully</Italic>
      </Bold>
    </Trans>`);
    const result = serializeJsxChildren(children);

    expect(result.message).toBe(
      '<Bold>Important: <Italic>read carefully</Italic></Bold>',
    );
  });
});

describe('serializeJsxChildren with plural()', () => {
  it('serializes plural() call to ICU format', () => {
    const children = getChildren(
      '<Trans>You have {plural(count, { one: "# item", other: "# items" })} in cart</Trans>',
    );
    const result = serializeJsxChildren(children);

    expect(result.message).toBe(
      'You have {count, plural, one {# item} other {# items}} in cart',
    );
    // The variable should be tracked in placeholders
    expect(result.placeholders).toEqual({ count: 'count' });
  });

  it('serializes plural() with all CLDR forms', () => {
    const children = getChildren(`
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
    const result = serializeJsxChildren(children);

    expect(result.message).toBe(
      '{n, plural, zero {none} one {one} two {two} few {few} many {many} other {other}}',
    );
    expect(result.placeholders).toEqual({ n: 'n' });
  });

  it('handles plural() alongside regular placeholders', () => {
    const children = getChildren(
      '<Trans>Hello {name}, you have {plural(count, { one: "# message", other: "# messages" })}</Trans>',
    );
    const result = serializeJsxChildren(children);

    expect(result.message).toBe(
      'Hello {name}, you have {count, plural, one {# message} other {# messages}}',
    );
    expect(result.placeholders).toEqual({
      name: 'name',
      count: 'count',
    });
  });

  it('handles plural() with member expression value', () => {
    const children = getChildren(
      '<Trans>Items: {plural(data.count, { one: "#", other: "#" })}</Trans>',
    );
    const result = serializeJsxChildren(children);

    expect(result.message).toBe(
      'Items: {data.count, plural, one {#} other {#}}',
    );
    // Member expressions use the full path as key
    expect(result.placeholders).toEqual({ 'data.count': 'data.count' });
  });

  it('handles plural() inside JSX elements', () => {
    const children = getChildren(
      '<Trans><span>{plural(count, { one: "# item", other: "# items" })}</span></Trans>',
    );
    const result = serializeJsxChildren(children);

    expect(result.message).toBe(
      '<span>{count, plural, one {# item} other {# items}}</span>',
    );
    expect(result.components).toEqual(['span']);
    expect(result.placeholders).toEqual({ count: 'count' });
  });

  it('escapes ICU special chars in plural forms', () => {
    const children = getChildren(
      '<Trans>{plural(count, { one: "{count} item", other: "{count} items" })}</Trans>',
    );
    const result = serializeJsxChildren(children);

    // Curly braces should be escaped in ICU
    expect(result.message).toContain("one {'{count}' item}");
  });
});

describe('serializeJsxChildren componentNodes', () => {
  it('stores componentNodes parallel to components', () => {
    const children = getChildren(
      '<Trans>Click <Link>here</Link> or <Bold>this</Bold></Trans>',
    );
    const result = serializeJsxChildren(children);

    expect(result.componentNodes).toHaveLength(2);
    expect(result.components).toEqual(['Link', 'Bold']);
  });

  it('preserves JSX attributes on componentNodes', () => {
    const children = getChildren(
      '<Trans>Style <Text size="inherit" fw={500}>content</Text> here</Trans>',
    );
    const result = serializeJsxChildren(children);

    expect(result.componentNodes).toHaveLength(1);
    const node = result.componentNodes[0]!;
    // Should be self-closing
    expect(node.openingElement.selfClosing).toBe(true);
    expect(node.children).toHaveLength(0);
    // Should have 2 attributes preserved
    expect(node.openingElement.attributes).toHaveLength(2);
  });

  it('preserves attributes on intrinsic elements', () => {
    const children = getChildren(
      '<Trans>Go <span style={{ fontWeight: 500 }}>bold</span></Trans>',
    );
    const result = serializeJsxChildren(children);

    expect(result.componentNodes).toHaveLength(1);
    const node = result.componentNodes[0]!;
    expect(node.openingElement.attributes).toHaveLength(1);
    // Name should be span
    expect(
      t.isJSXIdentifier(node.openingElement.name) &&
        node.openingElement.name.name,
    ).toBe('span');
  });

  it('creates self-closing nodes even for elements with children', () => {
    const children = getChildren(
      '<Trans><Link href="/test">click me</Link></Trans>',
    );
    const result = serializeJsxChildren(children);

    const node = result.componentNodes[0]!;
    expect(node.openingElement.selfClosing).toBe(true);
    expect(node.children).toHaveLength(0);
    // Should preserve the href attribute
    expect(node.openingElement.attributes).toHaveLength(1);
  });

  it('handles self-closing JSX elements', () => {
    const children = getChildren('<Trans>Line<br/>break</Trans>');
    const result = serializeJsxChildren(children);

    expect(result.componentNodes).toHaveLength(1);
    expect(result.componentNodes[0]!.openingElement.selfClosing).toBe(true);
  });

  it('returns empty componentNodes when no components', () => {
    const children = getChildren('<Trans>Hello {name}</Trans>');
    const result = serializeJsxChildren(children);

    expect(result.componentNodes).toEqual([]);
  });
});
