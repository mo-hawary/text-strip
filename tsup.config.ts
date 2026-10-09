import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'iife'],
  globalName: 'TextStrip',
  dts: true,
  minify: true,
  clean: true,
  target: 'es2019',
  sourcemap: false,
});
