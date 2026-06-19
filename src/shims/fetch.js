// Shim: redirect whatwg-fetch imports to React Native's native fetch.
// This prevents Supabase's cross-fetch dependency from using the
// XMLHttpRequest polyfill which fails in some React Native environments.
exports.fetch = global.fetch
exports.Headers = global.Headers
exports.Request = global.Request
exports.Response = global.Response
