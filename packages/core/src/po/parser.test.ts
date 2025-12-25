import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadLocaleCatalogs,
  loadPoFile,
  parsePoString,
  serializePoString,
  writePoFile,
} from './parser';

describe('PO Parser', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('parsePoString', () => {
    it('parses a simple PO file', () => {
      const poContent = `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr "Hola"
`;
      const catalog = parsePoString(poContent, 'es');

      expect(catalog.locale).toBe('es');
      expect(catalog.messages.size).toBe(1);

      const msg = catalog.messages.get('Hello');
      expect(msg).toBeDefined();
      expect(msg!.source).toBe('Hello');
      expect(msg!.translation).toBe('Hola');
    });

    it('parses messages with context (msgctxt)', () => {
      const poContent = `
msgid ""
msgstr ""
"Language: es\\n"

msgctxt "button"
msgid "Submit"
msgstr "Enviar"

msgctxt "form"
msgid "Submit"
msgstr "Enviar formulario"
`;
      const catalog = parsePoString(poContent, 'es');

      expect(catalog.messages.size).toBe(2);

      // Context is used to create unique key
      const buttonMsg = catalog.messages.get('button\u0004Submit');
      const formMsg = catalog.messages.get('form\u0004Submit');

      expect(buttonMsg).toBeDefined();
      expect(buttonMsg!.context).toBe('button');
      expect(buttonMsg!.translation).toBe('Enviar');

      expect(formMsg).toBeDefined();
      expect(formMsg!.context).toBe('form');
      expect(formMsg!.translation).toBe('Enviar formulario');
    });

    it('parses extracted comments (#.)', () => {
      const poContent = `
msgid ""
msgstr ""
"Language: es\\n"

#. This is a greeting message
#. Shown on the homepage
msgid "Welcome"
msgstr "Bienvenido"
`;
      const catalog = parsePoString(poContent, 'es');
      const msg = catalog.messages.get('Welcome');

      expect(msg!.comments).toEqual([
        'This is a greeting message',
        'Shown on the homepage',
      ]);
    });

    it('parses reference comments (#:)', () => {
      const poContent = `
msgid ""
msgstr ""
"Language: es\\n"

#: src/components/Header.tsx:42
#: src/pages/Home.tsx:15
msgid "Welcome"
msgstr "Bienvenido"
`;
      const catalog = parsePoString(poContent, 'es');
      const msg = catalog.messages.get('Welcome');

      expect(msg!.references).toEqual([
        'src/components/Header.tsx:42',
        'src/pages/Home.tsx:15',
      ]);
    });

    it('parses flags (#,)', () => {
      const poContent = `
msgid ""
msgstr ""
"Language: es\\n"

#, fuzzy, icu-format
msgid "Hello {name}"
msgstr "Hola {name}"
`;
      const catalog = parsePoString(poContent, 'es');
      const msg = catalog.messages.get('Hello {name}');

      expect(msg!.flags).toContain('fuzzy');
      expect(msg!.flags).toContain('icu-format');
    });

    it('handles untranslated messages', () => {
      const poContent = `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Untranslated"
msgstr ""
`;
      const catalog = parsePoString(poContent, 'es');
      const msg = catalog.messages.get('Untranslated');

      expect(msg!.translation).toBe('');
    });
  });

  describe('serializePoString', () => {
    it('serializes a catalog to PO format', () => {
      const poContent = `
msgid ""
msgstr ""
"Language: es\\n"

msgid "Hello"
msgstr "Hola"
`;
      const catalog = parsePoString(poContent, 'es');
      const serialized = serializePoString(catalog);

      expect(serialized).toContain('msgid "Hello"');
      expect(serialized).toContain('msgstr "Hola"');
    });

    it('round-trips a catalog correctly', () => {
      const poContent = `
msgid ""
msgstr ""
"Language: es\\n"

#. Comment
#: src/file.tsx:10
#, icu-format
msgctxt "context"
msgid "Source"
msgstr "Translation"
`;
      const catalog = parsePoString(poContent, 'es');
      const serialized = serializePoString(catalog);
      const reparsed = parsePoString(serialized, 'es');

      expect(reparsed.messages.size).toBe(catalog.messages.size);

      const original = catalog.messages.get('context\u0004Source');
      const roundTripped = reparsed.messages.get('context\u0004Source');

      expect(roundTripped!.source).toBe(original!.source);
      expect(roundTripped!.translation).toBe(original!.translation);
      expect(roundTripped!.context).toBe(original!.context);
    });
  });

  describe('loadPoFile', () => {
    it('loads a PO file from disk', async () => {
      const poContent = `
msgid ""
msgstr ""
"Language: fr\\n"

msgid "Test"
msgstr "Test traduit"
`;
      const filePath = join(tempDir, 'test.po');
      await fs.writeFile(filePath, poContent);

      const catalog = await loadPoFile(filePath, 'fr');

      expect(catalog.locale).toBe('fr');
      expect(catalog.messages.get('Test')!.translation).toBe('Test traduit');
    });
  });

  describe('writePoFile', () => {
    it('writes a catalog to disk', async () => {
      const poContent = `
msgid ""
msgstr ""
"Language: de\\n"

msgid "Save"
msgstr "Speichern"
`;
      const catalog = parsePoString(poContent, 'de');
      const filePath = join(tempDir, 'output.po');

      await writePoFile(filePath, catalog);

      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toContain('msgid "Save"');
      expect(written).toContain('msgstr "Speichern"');
    });
  });

  describe('loadLocaleCatalogs', () => {
    it('loads flat structure (locales/{locale}.po)', async () => {
      // Create flat structure
      const localesDir = join(tempDir, 'flat-locales');
      await fs.mkdir(localesDir, { recursive: true });

      const poContent = `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"
`;
      await fs.writeFile(join(localesDir, 'en.po'), poContent);

      const catalogs = await loadLocaleCatalogs(localesDir, 'en');

      expect(catalogs.size).toBe(1);
      expect(catalogs.has(undefined)).toBe(true); // No namespace
      const catalog = catalogs.get(undefined)!;
      expect(catalog.locale).toBe('en');
      expect(catalog.namespace).toBeUndefined();
      expect(catalog.messages.get('Hello')).toBeDefined();
    });

    it('loads namespaced structure (locales/{locale}/{namespace}.po)', async () => {
      // Create namespaced structure
      const localesDir = join(tempDir, 'ns-locales');
      const enDir = join(localesDir, 'en');
      await fs.mkdir(enDir, { recursive: true });

      const authPo = `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Login"
msgstr "Login"
`;
      const dashPo = `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Dashboard"
msgstr "Dashboard"
`;
      await fs.writeFile(join(enDir, 'auth.po'), authPo);
      await fs.writeFile(join(enDir, 'dashboard.po'), dashPo);

      const catalogs = await loadLocaleCatalogs(localesDir, 'en');

      expect(catalogs.size).toBe(2);
      expect(catalogs.has('auth')).toBe(true);
      expect(catalogs.has('dashboard')).toBe(true);

      const authCatalog = catalogs.get('auth')!;
      expect(authCatalog.namespace).toBe('auth');
      expect(authCatalog.messages.get('Login')).toBeDefined();

      const dashCatalog = catalogs.get('dashboard')!;
      expect(dashCatalog.namespace).toBe('dashboard');
      expect(dashCatalog.messages.get('Dashboard')).toBeDefined();
    });

    it('loads hybrid structure (both flat and namespaced)', async () => {
      // Create hybrid structure
      const localesDir = join(tempDir, 'hybrid-locales');
      const enDir = join(localesDir, 'en');
      await fs.mkdir(enDir, { recursive: true });

      // Flat file for non-namespaced messages
      const flatPo = `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Hello"
msgstr "Hello"
`;
      // Namespaced file
      const authPo = `
msgid ""
msgstr ""
"Language: en\\n"

msgid "Login"
msgstr "Login"
`;
      await fs.writeFile(join(localesDir, 'en.po'), flatPo);
      await fs.writeFile(join(enDir, 'auth.po'), authPo);

      const catalogs = await loadLocaleCatalogs(localesDir, 'en');

      expect(catalogs.size).toBe(2);
      expect(catalogs.has(undefined)).toBe(true); // Flat
      expect(catalogs.has('auth')).toBe(true); // Namespaced

      expect(catalogs.get(undefined)!.messages.get('Hello')).toBeDefined();
      expect(catalogs.get('auth')!.messages.get('Login')).toBeDefined();
    });

    it('returns empty map when no files exist', async () => {
      const localesDir = join(tempDir, 'empty-locales');
      await fs.mkdir(localesDir, { recursive: true });

      const catalogs = await loadLocaleCatalogs(localesDir, 'en');

      expect(catalogs.size).toBe(0);
    });
  });
});
