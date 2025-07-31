// app/entry.sentry.js
import "react-native-reanimated"; // FIRST import, before anything

import "./sentrySetup"; // your Sentry.init() lives here
import "expo-router/entry"; // then hand off to Expo Router
