import { describe, expect, it } from 'vitest';
import { getChunkId } from './chunk-id';

describe('getChunkId', () => {
  const projectRoot = '/project';

  it('generates ID from filename with hash suffix', () => {
    const id = getChunkId('/project/src/pages/HomePage.tsx', projectRoot);

    expect(id).toMatch(/^HomePage_[a-zA-Z0-9_-]{8}$/);
  });

  it('generates unique IDs for files with same basename in different directories', () => {
    const id1 = getChunkId('/project/src/pages/HomePage.tsx', projectRoot);
    const id2 = getChunkId('/project/src/admin/HomePage.tsx', projectRoot);

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^HomePage_/);
    expect(id2).toMatch(/^HomePage_/);
  });

  it('generates deterministic output (same file always gets same ID)', () => {
    const id1 = getChunkId('/project/src/pages/HomePage.tsx', projectRoot);
    const id2 = getChunkId('/project/src/pages/HomePage.tsx', projectRoot);

    expect(id1).toBe(id2);
  });

  it('uses parent directory name for index files', () => {
    const id = getChunkId('/project/src/pages/Home/index.tsx', projectRoot);

    expect(id).toMatch(/^Home_[a-zA-Z0-9_-]{8}$/);
  });

  it('handles various file extensions', () => {
    const tsx = getChunkId('/project/src/App.tsx', projectRoot);
    const ts = getChunkId('/project/src/App.ts', projectRoot);
    const jsx = getChunkId('/project/src/App.jsx', projectRoot);

    // Same basename but different extensions should have same prefix but different hash
    expect(tsx).toMatch(/^App_/);
    expect(ts).toMatch(/^App_/);
    expect(jsx).toMatch(/^App_/);
  });

  it('handles nested index files', () => {
    const id = getChunkId(
      '/project/src/features/auth/components/LoginForm/index.tsx',
      projectRoot,
    );

    expect(id).toMatch(/^LoginForm_[a-zA-Z0-9_-]{8}$/);
  });

  it('handles paths with special characters', () => {
    const id = getChunkId('/project/src/pages/my-page.tsx', projectRoot);

    expect(id).toMatch(/^my-page_[a-zA-Z0-9_-]{8}$/);
  });
});
