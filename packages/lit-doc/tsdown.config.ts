import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/index.ts', browser: 'src/browser/index.ts', worker: 'src/worker/entry.ts',
    conversion: 'src/conversion/index.ts', 'conversion-browser': 'src/browser/conversion/index.ts',
    'conversion-worker': 'src/worker/conversion/entry.ts', 'conversion-worker-runtime': 'src/worker/conversion/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
  noExternal: ['fflate'],
  target: 'es2022',
  fixedExtension: true,
})
