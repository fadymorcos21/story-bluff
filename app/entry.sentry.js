// app/entry.sentry.js
import "react-native-reanimated"; // FIRST import, before anything
import "./sentrySetup"; // your Sentry.init() lives here
setTimeout(() => {
  require("expo-router/entry");
}, 3000); // or 300, etc.
