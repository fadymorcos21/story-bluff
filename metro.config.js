const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// 👉 Patch to avoid lightningcss by forcing terser
config.transformer = {
  ...config.transformer,
  minifierPath: "metro-minify-terser",
};

// ✅ Also disable css interop (avoids lightningcss entirely)
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
};

module.exports = withNativeWind(config, {
  input: "./global.css",
});
