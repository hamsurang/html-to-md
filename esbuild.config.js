const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';
const isWatch = process.argv.includes('--watch');

const sharedOptions = {
  bundle: true,
  platform: 'browser',
  target: ['chrome116'],
  format: 'iife',
  treeShaking: true,
  sourcemap: isProduction ? false : 'inline',
  minify: isProduction,
  legalComments: isProduction ? 'external' : 'inline',
  logLevel: 'info',
  metafile: true,
};

const contentScriptConfig = {
  ...sharedOptions,
  entryPoints: [path.resolve(__dirname, 'src/content.js')],
  outfile: path.resolve(__dirname, 'dist/content.js'),
};

const backgroundConfig = {
  ...sharedOptions,
  entryPoints: [path.resolve(__dirname, 'src/background.js')],
  outfile: path.resolve(__dirname, 'dist/background.js'),
};

const popupConfig = {
  ...sharedOptions,
  entryPoints: [path.resolve(__dirname, 'src/popup/popup.js')],
  outfile: path.resolve(__dirname, 'dist/popup/popup.js'),
};

function copyStaticFiles() {
  const copies = [
    { from: 'manifest.json', to: 'dist/manifest.json' },
    { from: 'src/popup/popup.html', to: 'dist/popup/popup.html' },
    { from: 'src/popup/popup.css', to: 'dist/popup/popup.css' },
  ];

  const distIconsDir = path.resolve(__dirname, 'dist/icons');
  fs.mkdirSync(distIconsDir, { recursive: true });

  const iconsDir = path.resolve(__dirname, 'icons');
  if (fs.existsSync(iconsDir)) {
    for (const file of fs.readdirSync(iconsDir)) {
      fs.copyFileSync(
        path.resolve(iconsDir, file),
        path.resolve(distIconsDir, file)
      );
    }
  }

  for (const { from, to } of copies) {
    const src = path.resolve(__dirname, from);
    const dest = path.resolve(__dirname, to);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
  console.log('Static files copied.');
}

async function build() {
  const distDir = path.resolve(__dirname, 'dist');
  if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true });
  fs.mkdirSync(distDir, { recursive: true });

  const startTime = Date.now();

  await Promise.all([
    esbuild.build(contentScriptConfig),
    esbuild.build(backgroundConfig),
    esbuild.build(popupConfig),
  ]);

  copyStaticFiles();
  console.log(`\nBuild completed in ${Date.now() - startTime}ms`);
}

async function watch() {
  const distDir = path.resolve(__dirname, 'dist');
  if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true });
  fs.mkdirSync(distDir, { recursive: true });

  const [contentCtx, backgroundCtx, popupCtx] = await Promise.all([
    esbuild.context(contentScriptConfig),
    esbuild.context(backgroundConfig),
    esbuild.context(popupConfig),
  ]);

  await Promise.all([
    contentCtx.watch(),
    backgroundCtx.watch(),
    popupCtx.watch(),
  ]);

  copyStaticFiles();
  console.log('Watching for changes... (Ctrl+C to stop)');
}

if (isWatch) {
  watch().catch(e => { console.error(e); process.exit(1); });
} else {
  build().catch(e => { console.error(e); process.exit(1); });
}
