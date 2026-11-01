import { defineConfig } from 'vitest/config'

// Unit tests cover the data layer and routing; they do not render React Native Web.
export default defineConfig({ test: { environment: 'node' } })
