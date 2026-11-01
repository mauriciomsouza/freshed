// Expo's default Metro config detects pnpm/npm workspaces automatically (SDK 52+).
const { getDefaultConfig } = require('expo/metro-config')

module.exports = getDefaultConfig(__dirname)
