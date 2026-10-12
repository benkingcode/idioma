import type { Node } from '@babel/types';

/**
 * The strings a static id can be: a string literal, or a conditional whose
 * branches are string literals or such conditionals, for example
 * `live ? 'set.live' : 'set.past'`. Returns null when any branch is something
 * else, which cannot be inlined at build time.
 *
 * The Babel plugin and the CLI extractor both use this, so they agree on
 * what counts as a static id (issue #14).
 */
export function literalIdLeaves(
  node: Node | null | undefined,
): string[] | null {
  if (!node) return null;
  if (node.type === 'StringLiteral') return [node.value];
  if (node.type === 'ConditionalExpression') {
    const consequent = literalIdLeaves(node.consequent);
    const alternate = literalIdLeaves(node.alternate);
    return consequent && alternate ? [...consequent, ...alternate] : null;
  }
  return null;
}
