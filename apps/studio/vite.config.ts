import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { defineConfig } from 'vite'

const require = createRequire(import.meta.url)
// Resolve from the Studio so workspace packages (renderer, example app) pick up the same copy.
const rnw = dirname(require.resolve('react-native-web/package.json'))

/**
 * The Studio preview renders the app's real components with the same
 * renderer the Expo app uses. `react-native` is aliased to
 * `react-native-web`, so no separate web renderer is needed.
 *
 * Modes:
 *   default  base "/", demo mode unless VITE_FRESHED_API is set
 *   pages    base "/freshed/" for GitHub Pages, always demo mode
 */
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/freshed/' : '/',
  plugins: [react()],
  resolve: {
    alias: [{ find: /^react-native$/, replacement: rnw }],
    dedupe: ['react', 'react-dom'],
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.mjs', '.js', '.jsx', '.json'],
  },
  define: {
    __DEV__: JSON.stringify(mode !== 'production' && mode !== 'pages'),
    'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
    'import.meta.env.VITE_DEMO_FORCED': JSON.stringify(mode === 'pages'),
  },
  build: {
    outDir: mode === 'pages' ? 'dist-pages' : 'dist',
    chunkSizeWarningLimit: 1200,
  },
  preview: { port: 4173 },
}))
