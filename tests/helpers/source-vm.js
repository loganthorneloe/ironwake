import assert from 'node:assert/strict';
import vm from 'node:vm';
import { parsers } from 'prettier/plugins/babel';

// Production source is selected by syntax, so formatting and extraction do not
// change which code runs. The supplied context owns inert DOM/rendering services.
export function sourceNode(source, predicate) {
  let found;
  function visit(node) {
    if (found || !node || typeof node !== 'object') return;
    if (predicate(node)) {
      found = node;
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'comments', 'tokens'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(parsers.babel.parse(source).program);
  assert.ok(found, 'requested production syntax exists');
  return found;
}

export function functionSource(source, name) {
  const node = sourceNode(
    source,
    (node) => node.type === 'FunctionDeclaration' && node.id?.name === name,
  );
  return source.slice(node.start, node.end);
}

export function evaluateModule(source, context, exports, { filename = 'production module' } = {}) {
  const ast = parsers.babel.parse(source);
  const removals = [];
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') removals.push([node.start, node.end]);
    else if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
      removals.push([node.start, node.declaration?.start ?? node.end]);
    } else if (node.type === 'ExportAllDeclaration') removals.push([node.start, node.end]);
  }
  let script = source;
  for (const [start, end] of removals.sort((a, b) => b[0] - a[0])) {
    script = script.slice(0, start) + script.slice(end);
  }
  for (const name of exports) assert.match(name, /^[A-Za-z_$][\w$]*$/);
  return vm.runInContext(script + `\n;({${exports.join(',')}});`, context, { filename });
}
