import * as path from 'path';
import type * as esbuild from 'esbuild';
import type { EntryPoint } from '@softarc/native-federation';

// Maps each absolute script output path to the `outName` of the entry point it was built from.
export function mapOutputEntries(
  metafile: esbuild.Metafile,
  entryPoints: EntryPoint[],
  workingDir: string
): Map<string, string> {
  const entries = new Map<string, string>();

  for (const [outPath, output] of Object.entries(metafile.outputs)) {
    // Core fails the build when two results claim the same entry, so a stylesheet must not.
    if (!output.entryPoint || !/\.m?js$/.test(outPath)) continue;

    const source = path.resolve(workingDir, output.entryPoint);
    const baseName = path.basename(outPath);
    // One source exposed under two keys yields two outputs with the same entryPoint; only the
    // output name, `[name]` or `[name]-[hash]`, tells them apart.
    const entry = entryPoints
      .filter(ep => path.resolve(workingDir, ep.fileName) === source)
      .map(ep => ({ ep, out: path.parse(ep.outName).name }))
      .filter(({ out }) => baseName.startsWith(`${out}-`) || baseName.startsWith(`${out}.`))
      .sort((a, b) => b.out.length - a.out.length)[0];

    if (entry) entries.set(path.resolve(workingDir, outPath), entry.ep.outName);
  }

  return entries;
}
