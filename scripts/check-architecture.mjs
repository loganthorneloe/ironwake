import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parsers } from 'prettier/plugins/babel';

const DEFAULT_ROOTS = ['dist', 'worker', 'scripts', 'tests'];
const MODULE_EXTENSION = /\.(?:[cm]?js)$/;
const ARCHITECTURE_FOLDERS = ['catalog', 'builds', 'missions', 'simulation', 'app'];
const IGNORED_FOLDERS = new Set(['node_modules', '.git', '.openai', '.wrangler', 'vendor']);

function relativeName(root, filename) {
  return path.relative(root, filename).split(path.sep).join('/');
}

function architectureLayer(filename) {
  return ARCHITECTURE_FOLDERS.find((folder) => filename.startsWith(`dist/${folder}/`));
}

function isRuntimeModule(filename) {
  return (
    filename === 'dist/core.js' ||
    filename === 'dist/app.js' ||
    ['app', 'simulation'].includes(architectureLayer(filename))
  );
}

async function collectModules(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const modules = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (IGNORED_FOLDERS.has(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) modules.push(...(await collectModules(filename)));
    else if (entry.isFile() && MODULE_EXTENSION.test(entry.name)) modules.push(filename);
  }
  return modules;
}

function literalImports(source) {
  const ast = parsers.babel.parse(source);
  const imports = [];

  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'ImportDeclaration' ||
      node.type === 'ExportNamedDeclaration' ||
      node.type === 'ExportAllDeclaration' ||
      node.type === 'ImportExpression'
    ) {
      if (typeof node.source?.value === 'string') {
        imports.push({ specifier: node.source.value, line: node.loc?.start.line ?? 1 });
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }

  visit(ast);
  return imports;
}

function closesCycle(graph, component) {
  const members = new Set(component);
  const start = component.find((filename) => architectureLayer(filename));
  const active = [];
  const visited = new Set();

  function visit(filename) {
    if (visited.has(filename)) return null;
    visited.add(filename);
    active.push(filename);
    for (const target of graph.get(filename) ?? []) {
      if (!members.has(target)) continue;
      if (target === start) return [...active, start];
      const cycle = visit(target);
      if (cycle) return cycle;
    }
    active.pop();
    return null;
  }

  return visit(start);
}

function findCycles(graph) {
  let nextIndex = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const pending = [];
  const onStack = new Set();
  const cycles = [];

  function visit(filename) {
    indexes.set(filename, nextIndex);
    lowLinks.set(filename, nextIndex++);
    pending.push(filename);
    onStack.add(filename);

    for (const target of graph.get(filename) ?? []) {
      if (!graph.has(target)) continue;
      if (!indexes.has(target)) {
        visit(target);
        lowLinks.set(filename, Math.min(lowLinks.get(filename), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(filename, Math.min(lowLinks.get(filename), indexes.get(target)));
      }
    }

    if (lowLinks.get(filename) !== indexes.get(filename)) return;
    const component = [];
    let target;
    do {
      target = pending.pop();
      onStack.delete(target);
      component.push(target);
    } while (target !== filename);

    if (
      component.some((member) => architectureLayer(member)) &&
      (component.length > 1 || graph.get(filename)?.has(filename))
    ) {
      cycles.push(closesCycle(graph, component));
    }
  }

  for (const filename of graph.keys()) {
    if (!indexes.has(filename)) visit(filename);
  }
  return cycles;
}

export async function analyzeArchitecture(root, { sourceRoots = DEFAULT_ROOTS } = {}) {
  root = path.resolve(root);
  const filenames = (
    await Promise.all(sourceRoots.map((directory) => collectModules(path.resolve(root, directory))))
  )
    .flat()
    .sort();
  const errors = [];
  const modules = new Map();

  for (const filename of filenames) {
    const name = relativeName(root, filename);
    const source = await readFile(filename, 'utf8');
    const module = {
      name,
      lines: source ? source.split(/\r?\n/).length - Number(source.endsWith('\n')) : 0,
      imports: new Set(),
      importLines: new Map(),
      layer: architectureLayer(name),
    };
    modules.set(name, module);

    let imports;
    try {
      imports = literalImports(source);
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
      continue;
    }

    for (const { specifier, line } of imports) {
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) continue;

      let target;
      try {
        const url = new URL(specifier, pathToFileURL(filename));
        url.search = '';
        url.hash = '';
        target = fileURLToPath(url);
        if (!(await stat(target)).isFile()) throw new Error('Import target is not a file');
      } catch {
        errors.push(`${name}:${line}: missing relative import ${JSON.stringify(specifier)}`);
        continue;
      }

      const targetName = relativeName(root, target);
      module.imports.add(targetName);
      module.importLines.set(targetName, line);
    }
  }

  // Follow legacy leaves too: a compatibility barrel must not bypass a layer rule.
  for (const module of modules.values()) {
    if (!['catalog', 'builds'].includes(module.layer)) continue;
    const visited = new Set([module.name]);
    const pending = [{ name: module.name, chain: [module.name] }];
    while (pending.length) {
      const current = pending.pop();
      for (const target of modules.get(current.name)?.imports ?? []) {
        if (visited.has(target)) continue;
        visited.add(target);
        const chain = [...current.chain, target];
        const line = module.importLines.get(chain[1]);
        if (isRuntimeModule(target)) {
          errors.push(
            `${module.name}:${line}: ${module.layer} must remain independent of runtime module ${target} (via ${chain.join(' -> ')})`,
          );
        } else pending.push({ name: target, chain });
      }
    }
  }

  const graph = new Map([...modules.values()].map((module) => [module.name, module.imports]));
  for (const cycle of findCycles(graph)) {
    errors.push(`Module cycle in extracted architecture: ${cycle.join(' -> ')}`);
  }

  return {
    errors,
    modules,
    architectureModules: [...modules.values()].filter((module) => module.layer).length,
  };
}

export function formatHotspotReport(modules) {
  const dependents = new Map();
  for (const module of modules.values()) {
    for (const target of module.imports) {
      dependents.set(target, (dependents.get(target) ?? 0) + 1);
    }
  }

  const sourceModules = [...modules.values()].filter((module) => module.name.startsWith('dist/'));
  const largest = [...sourceModules].sort(
    (a, b) => b.lines - a.lines || a.name.localeCompare(b.name),
  );
  const shared = [...sourceModules].sort(
    (a, b) =>
      (dependents.get(b.name) ?? 0) - (dependents.get(a.name) ?? 0) || a.name.localeCompare(b.name),
  );

  return [
    'Largest first-party browser modules (lines):',
    ...largest.slice(0, 12).map((module) => `  ${module.lines}  ${module.name}`),
    'Most imported browser modules (direct importers, including tests):',
    ...shared.slice(0, 12).map((module) => `  ${dependents.get(module.name) ?? 0}  ${module.name}`),
    'Use these signals to plan smaller module boundaries; size and fan-in are not conflict counts.',
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = await analyzeArchitecture(root);
  if (process.argv.includes('--report')) console.log(formatHotspotReport(result.modules));
  if (result.errors.length) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Architecture check passed: ${result.modules.size} modules, ${result.architectureModules} extracted modules.`,
    );
  }
}
