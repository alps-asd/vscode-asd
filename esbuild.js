const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');

esbuild.build({
    entryPoints: ['./src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    watch,
    minify,
    logLevel: 'info', // ビルドの詳細情報を出力
})
.then(() => {
    console.log('Build completed successfully');
})
.catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
});
