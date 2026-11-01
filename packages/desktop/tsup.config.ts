import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { main: 'src/main/index.ts', preload: 'src/preload/index.ts' },
  format: ['cjs'],
  platform: 'node',
  target: 'node22',
  external: ['electron'],
  noExternal: [/^@mtc\//],
  sourcemap: true,
  clean: true,
})