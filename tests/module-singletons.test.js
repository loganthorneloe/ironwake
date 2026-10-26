import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parsers } from 'prettier/plugins/babel';

// Browser ESM identity includes the query string. Existence checks alone cannot
// detect a second renderer, audio context or view state behind an older URL.
test('the production app graph uses one exact URL for each shared runtime module', async () => {
  const root = new URL('../dist/', import.meta.url);
  const shared = new Map(
    ['core.js', 'audio.js', 'view-controls.js', 'three-view.js'].map((name) => [name, new Set()]),
  );
  const visited = new Set();
  const pending = [new URL('app.js?v=ui-stack-1', root)];
  while (pending.length) {
    const url = pending.pop();
    const name = url.pathname.slice(root.pathname.length);
    if (shared.has(name)) shared.get(name).add(url.href);
    if (visited.has(url.href) || name.startsWith('vendor/')) continue;
    visited.add(url.href);
    const source = await readFile(fileURLToPath(url), 'utf8');
    const ast = parsers.babel.parse(source);
    for (const statement of ast.program.body) {
      if (
        !['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(
          statement.type,
        ) ||
        !statement.source?.value.startsWith('.')
      )
        continue;
      pending.push(new URL(statement.source.value, url));
    }
  }
  for (const [name, urls] of shared) {
    assert.equal(urls.size, 1, `${name} must be a singleton; observed ${[...urls].join(', ')}`);
  }
});
