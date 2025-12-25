import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { describe, expect, it } from 'vitest';
import { extractTransMessage, type ExtractedMessage } from './extract-trans';

function extractFromCode(code: string): ExtractedMessage[] {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const messages: ExtractedMessage[] = [];

  traverse(ast, {
    JSXElement(path) {
      const result = extractTransMessage(path, 'test.tsx');
      if (result) {
        messages.push(result);
      }
    },
  });

  return messages;
}

describe('extractTransMessage', () => {
  it('extracts a simple Trans component', () => {
    const messages = extractFromCode(`
      import { Trans } from '@idioma/react'
      const x = <Trans>Hello world</Trans>
    `);

    expect(messages).toHaveLength(1);
    expect(messages[0].source).toBe('Hello world');
    expect(messages[0].key).toBeDefined();
  });

  it('extracts Trans with id prop as explicit key', () => {
    const messages = extractFromCode(`
      import { Trans } from '@idioma/react'
      const x = <Trans id="greeting">Hello world</Trans>
    `);

    expect(messages).toHaveLength(1);
    expect(messages[0].key).toBe('greeting');
    expect(messages[0].source).toBe('Hello world');
  });

  it('extracts Trans with context prop', () => {
    const messages = extractFromCode(`
      import { Trans } from '@idioma/react'
      const x = <Trans context="homepage">Welcome</Trans>
    `);

    expect(messages).toHaveLength(1);
    expect(messages[0].context).toBe('homepage');
  });

  it('extracts Trans with interpolation', () => {
    const messages = extractFromCode(`
      import { Trans } from '@idioma/react'
      const x = <Trans>Hello {name}</Trans>
    `);

    expect(messages).toHaveLength(1);
    expect(messages[0].source).toBe('Hello {name}');
    expect(messages[0].placeholders).toEqual({ name: 'name' });
  });

  it('extracts Trans with JSX components', () => {
    const messages = extractFromCode(`
      import { Trans } from '@idioma/react'
      const x = <Trans>Click <Link>here</Link> to continue</Trans>
    `);

    expect(messages).toHaveLength(1);
    expect(messages[0].source).toBe('Click <0>here</0> to continue');
    expect(messages[0].components).toEqual(['Link']);
  });

  it('skips key-only Trans (no children)', () => {
    const messages = extractFromCode(`
      import { Trans } from '@idioma/react'
      const x = <Trans id="greeting" />
    `);

    expect(messages).toHaveLength(0);
  });

  it('includes file reference', () => {
    const messages = extractFromCode(`
      import { Trans } from '@idioma/react'
      const x = <Trans>Hello</Trans>
    `);

    expect(messages[0].references).toContain('test.tsx:3');
  });

  it('skips non-Trans components', () => {
    const messages = extractFromCode(`
      const x = <div>Hello world</div>
    `);

    expect(messages).toHaveLength(0);
  });

  it('extracts multiple Trans components', () => {
    const messages = extractFromCode(`
      import { Trans } from '@idioma/react'
      const x = (
        <div>
          <Trans>First</Trans>
          <Trans>Second</Trans>
        </div>
      )
    `);

    expect(messages).toHaveLength(2);
    expect(messages[0].source).toBe('First');
    expect(messages[1].source).toBe('Second');
  });

  it('generates consistent keys for same message', () => {
    const messages1 = extractFromCode(`
      import { Trans } from '@idioma/react'
      const x = <Trans>Hello world</Trans>
    `);

    const messages2 = extractFromCode(`
      import { Trans } from '@idioma/react'
      const y = <Trans>Hello world</Trans>
    `);

    expect(messages1[0].key).toBe(messages2[0].key);
  });

  it('generates different keys for different messages', () => {
    const messages = extractFromCode(`
      import { Trans } from '@idioma/react'
      const x = <Trans>Hello</Trans>
      const y = <Trans>Goodbye</Trans>
    `);

    expect(messages[0].key).not.toBe(messages[1].key);
  });

  // Namespace support tests
  describe('with namespace', () => {
    it('extracts Trans with ns prop', () => {
      const messages = extractFromCode(`
        import { Trans } from '@idioma/react'
        const x = <Trans ns="auth">Login</Trans>
      `);

      expect(messages).toHaveLength(1);
      expect(messages[0].source).toBe('Login');
      expect(messages[0].namespace).toBe('auth');
    });

    it('generates different keys for same message in different namespaces', () => {
      const messages = extractFromCode(`
        import { Trans } from '@idioma/react'
        const x = <Trans ns="auth">Submit</Trans>
        const y = <Trans ns="forms">Submit</Trans>
      `);

      expect(messages).toHaveLength(2);
      expect(messages[0].key).not.toBe(messages[1].key);
    });

    it('generates different keys with vs without namespace', () => {
      const messages = extractFromCode(`
        import { Trans } from '@idioma/react'
        const x = <Trans>Submit</Trans>
        const y = <Trans ns="auth">Submit</Trans>
      `);

      expect(messages).toHaveLength(2);
      expect(messages[0].key).not.toBe(messages[1].key);
      expect(messages[0].namespace).toBeUndefined();
      expect(messages[1].namespace).toBe('auth');
    });

    it('extracts Trans with both ns and context', () => {
      const messages = extractFromCode(`
        import { Trans } from '@idioma/react'
        const x = <Trans ns="auth" context="button">Submit</Trans>
      `);

      expect(messages).toHaveLength(1);
      expect(messages[0].namespace).toBe('auth');
      expect(messages[0].context).toBe('button');
    });

    it('generates unique keys for namespace + context combinations', () => {
      const messages = extractFromCode(`
        import { Trans } from '@idioma/react'
        const a = <Trans ns="auth" context="button">Submit</Trans>
        const b = <Trans ns="auth" context="link">Submit</Trans>
        const c = <Trans ns="forms" context="button">Submit</Trans>
      `);

      expect(messages).toHaveLength(3);
      expect(messages[0].key).not.toBe(messages[1].key);
      expect(messages[0].key).not.toBe(messages[2].key);
      expect(messages[1].key).not.toBe(messages[2].key);
    });

    it('generates consistent keys for same namespace', () => {
      const messages1 = extractFromCode(`
        import { Trans } from '@idioma/react'
        const x = <Trans ns="auth">Login</Trans>
      `);

      const messages2 = extractFromCode(`
        import { Trans } from '@idioma/react'
        const y = <Trans ns="auth">Login</Trans>
      `);

      expect(messages1[0].key).toBe(messages2[0].key);
    });
  });
});
