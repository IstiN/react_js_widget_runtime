// Browser bundle: src/index.js -> dist/jsr-widget.js (ESM). The `?text`
// imports embed the canonical bootstrap halves as strings for the Blob
// worker, exactly what the Flutter web backend does with its script build.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

const textLoader = {
  name: 'text-loader',
  setup(b) {
    b.onResolve({ filter: /\?text$/ }, (args) => ({
      path: resolve(args.resolveDir, args.path.replace(/\?text$/, '')),
      namespace: 'text',
    }));
    b.onLoad({ filter: /.*/, namespace: 'text' }, (args) => ({
      contents: readFileSync(args.path, 'utf8'),
      loader: 'text',
    }));
  },
};

await build({
  entryPoints: [resolve(root, 'src/index.js')],
  outfile: resolve(root, 'dist/jsr-widget.js'),
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: false,
  plugins: [textLoader],
});

console.log('build: dist/jsr-widget.js');
