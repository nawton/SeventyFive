const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Redirect whatwg-fetch to a no-op so Supabase uses React Native's
// native fetch (passed via global.fetch in src/lib/supabase.ts)
// instead of the XMLHttpRequest-based polyfill which fails on device.
config.resolver.resolveRequest = (context, moduleName, platform, realModuleName) => {
  if (moduleName === 'whatwg-fetch') {
    return {
      type: 'sourceFile',
      filePath: require.resolve('./src/shims/fetch.js'),
    }
  }
  return context.resolveRequest(context, moduleName, platform, realModuleName)
}

module.exports = config
