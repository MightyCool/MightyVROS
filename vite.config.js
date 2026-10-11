import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Stamps public/sw.js with a build id + precache list of every emitted file.
function swStamp() {
  let outDir = 'dist';
  return {
    name: 'sw-stamp',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;
      const files = [];
      const walk = (d) => {
        for (const f of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, f.name);
          if (f.isDirectory()) walk(p);
          else files.push(path.relative(outDir, p).split(path.sep).join('/'));
        }
      };
      walk(outDir);
      const list = files.filter((f) => f !== 'sw.js').map((f) => './' + f);
      list.push('./');
      const s = fs.readFileSync(swPath, 'utf8')
        .replace('__BUILD_ID__', String(Date.now()))
        .replace('"__PRECACHE__"', JSON.stringify(list));
      fs.writeFileSync(swPath, s);
    },
  };
}

// base './' = relative assets, so it works from https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  build: { target: ['es2019', 'safari14'], chunkSizeWarningLimit: 900 },
  plugins: [swStamp()],
});
