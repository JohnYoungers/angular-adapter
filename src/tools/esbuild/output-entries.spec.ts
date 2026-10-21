import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as esbuild from 'esbuild';
import type { EntryPoint } from '@softarc/native-federation';

import { mapOutputEntries } from './output-entries.js';

// Runs real esbuild with the options angular-bundler.ts uses for exposed modules (entry names,
// splitting, absWorkingDir, write: false), so the metafile shape is esbuild's own.
let ws: string;

function writeSources(files: Record<string, string>) {
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(ws, name)), { recursive: true });
    fs.writeFileSync(path.join(ws, name), text);
  }
}

function context(entryPoints: EntryPoint[], hash = true) {
  return esbuild.context({
    entryPoints: entryPoints.map(ep => ({
      in: path.join(ws, ep.fileName),
      out: path.parse(ep.outName).name,
    })),
    outdir: path.join(ws, 'dist'),
    absWorkingDir: ws,
    entryNames: hash ? '[name]-[hash]' : '[name]',
    write: false,
    metafile: true,
    bundle: true,
    splitting: true,
    format: 'esm',
    logLevel: 'silent',
  });
}

async function buildEntries(entryPoints: EntryPoint[], hash = true) {
  const ctx = await context(entryPoints, hash);
  try {
    const result = await ctx.rebuild();
    return { result, entries: mapOutputEntries(result.metafile!, entryPoints, ws) };
  } finally {
    await ctx.dispose();
  }
}

beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-output-entries-'));
});

afterEach(() => {
  fs.rmSync(ws, { recursive: true, force: true });
});

describe('mapOutputEntries', () => {
  // core#193: core cut `chunk-<hash>.js` at its last `-` and published the shared chunk as `./chunk`.
  it('maps an exposed `chunk` to its entry, not to the split chunk', async () => {
    writeSources({
      'src/shared.ts': 'export const shared = () => "shared";',
      'src/chunk.ts': 'import { shared } from "./shared"; export const chunk = shared();',
      'src/other.ts': 'import { shared } from "./shared"; export const other = shared();',
    });
    const entryPoints = [
      { fileName: 'src/chunk.ts', outName: 'chunk.js' },
      { fileName: 'src/other.ts', outName: 'other.js' },
    ];

    const { result, entries } = await buildEntries(entryPoints);

    const scripts = result.outputFiles!.map(f => path.basename(f.path));
    // Sanity check: the fixture really produces a split chunk next to the `chunk` entry.
    expect(scripts.filter(name => name.startsWith('chunk-'))).toHaveLength(2);
    expect([...entries.values()].sort()).toEqual(['chunk.js', 'other.js']);
    const chunkOutput = [...entries].find(([, entry]) => entry === 'chunk.js')![0];
    expect(result.metafile!.outputs[path.relative(ws, chunkOutput)].entryPoint).toBe(
      'src/chunk.ts'
    );
  });

  it('keys entries by the absolute output path, as in outputFiles', async () => {
    writeSources({ 'src/a.ts': 'export const a = 1;' });
    const entryPoints = [{ fileName: 'src/a.ts', outName: 'a.js' }];

    const { result, entries } = await buildEntries(entryPoints);

    expect(entries.get(result.outputFiles![0].path)).toBe('a.js');
  });

  // core fails the build when two results claim one entry, so the stylesheet must not.
  it('sets the entry on the script only, not on the stylesheet it imports', async () => {
    writeSources({
      'src/styled.ts': 'import "./styled.css"; export const styled = 1;',
      'src/styled.css': '.a { color: red; }',
    });
    const entryPoints = [{ fileName: 'src/styled.ts', outName: 'styled.js' }];

    const { result, entries } = await buildEntries(entryPoints);

    const css = result.outputFiles!.find(f => f.path.endsWith('.css'))!;
    expect(entries.has(css.path)).toBe(false);
    expect([...entries.values()]).toEqual(['styled.js']);
  });

  // esbuild 0.28.2 leaves entryPoint off extracted CSS, but the core team reported seeing it set
  // there (handover for core#193); a synthetic metafile covers that shape.
  it('ignores a stylesheet that carries the entry point', () => {
    const metafile = {
      inputs: {},
      outputs: {
        'dist/styled-AAAA.js': { entryPoint: 'src/styled.ts' },
        'dist/styled-BBBB.css': { entryPoint: 'src/styled.ts' },
      },
    } as unknown as esbuild.Metafile;

    const entries = mapOutputEntries(
      metafile,
      [{ fileName: 'src/styled.ts', outName: 'styled.js' }],
      ws
    );

    expect(entries).toEqual(new Map([[path.join(ws, 'dist/styled-AAAA.js'), 'styled.js']]));
  });

  it.each([true, false])('tells apart one file exposed under two keys (hash: %s)', async hash => {
    writeSources({ 'src/cmp.ts': 'export const cmp = 1;' });
    // Core flattens `./a/Cmp` + `./b/Cmp` to `Cmp.js` + `Cmp_2.js`.
    const entryPoints = [
      { fileName: 'src/cmp.ts', outName: 'Cmp.js' },
      { fileName: 'src/cmp.ts', outName: 'Cmp_2.js' },
    ];

    const { entries } = await buildEntries(entryPoints, hash);

    const byEntry = Object.fromEntries([...entries].map(([out, entry]) => [entry, out]));
    expect(path.basename(byEntry['Cmp.js'])).toMatch(hash ? /^Cmp-[^_]+\.js$/ : /^Cmp\.js$/);
    expect(path.basename(byEntry['Cmp_2.js'])).toMatch(hash ? /^Cmp_2-.+\.js$/ : /^Cmp_2\.js$/);
  });

  // `a-b-<hash>.js` also starts with `a-`, so the longest matching name has to win.
  it('prefers the longest out name when one is a dash-prefix of the other', async () => {
    writeSources({ 'src/x.ts': 'export const x = 1;' });
    const entryPoints = [
      { fileName: 'src/x.ts', outName: 'a.js' },
      { fileName: 'src/x.ts', outName: 'a-b.js' },
    ];

    const { entries } = await buildEntries(entryPoints);

    const byEntry = Object.fromEntries([...entries].map(([out, entry]) => [entry, out]));
    expect(path.basename(byEntry['a-b.js'])).toMatch(/^a-b-/);
    expect(path.basename(byEntry['a.js'])).not.toMatch(/^a-b-/);
  });

  it('accepts entry points handed over absolute', async () => {
    writeSources({ 'libs/ui/index.ts': 'export const ui = 1;' });
    const entryPoints = [{ fileName: path.join(ws, 'libs/ui/index.ts'), outName: 'ui.js' }];
    const ctx = await esbuild.context({
      entryPoints: [{ in: entryPoints[0].fileName, out: 'ui' }],
      outdir: path.join(ws, 'dist'),
      absWorkingDir: ws,
      entryNames: '[name]-[hash]',
      write: false,
      metafile: true,
      bundle: true,
      format: 'esm',
      logLevel: 'silent',
    });

    try {
      const result = await ctx.rebuild();
      expect([...mapOutputEntries(result.metafile!, entryPoints, ws).values()]).toEqual(['ui.js']);
    } finally {
      await ctx.dispose();
    }
  });

  it('keeps the entries across a watch rebuild', async () => {
    writeSources({
      'src/shared.ts': 'export const shared = () => "shared";',
      'src/chunk.ts': 'import { shared } from "./shared"; export const chunk = shared();',
      'src/other.ts': 'import { shared } from "./shared"; export const other = shared();',
    });
    const entryPoints = [
      { fileName: 'src/chunk.ts', outName: 'chunk.js' },
      { fileName: 'src/other.ts', outName: 'other.js' },
    ];
    const ctx = await context(entryPoints);

    try {
      const first = await ctx.rebuild();
      writeSources({
        'src/chunk.ts': 'import { shared } from "./shared"; export const chunk = shared() + "!";',
      });
      const second = await ctx.rebuild();

      const firstEntries = mapOutputEntries(first.metafile!, entryPoints, ws);
      const secondEntries = mapOutputEntries(second.metafile!, entryPoints, ws);
      expect([...secondEntries.values()].sort()).toEqual(['chunk.js', 'other.js']);
      // The changed entry got a new hash, so this really is a fresh mapping.
      expect([...secondEntries.keys()]).not.toEqual([...firstEntries.keys()]);
    } finally {
      await ctx.dispose();
    }
  });
});
