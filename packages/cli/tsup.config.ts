import { defineConfig } from 'tsup'

// Bundle the workspace packages into one executable file; zod stays a dependency.
export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  clean: true,
  noExternal: ['@freshed/ai', '@freshed/schema'],
})
