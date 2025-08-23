// app.config.js
export default ({ config }) => ({
  ...config,
  expo: {
    name: "Story Bluff",
    slug: "story-bluff",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "storybluff",
    owner: "fadymorcos21",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      icon: "./assets/icon.png",
      bundleIdentifier: "com.fadymorcos21.storybluff",
      buildNumber: "1.1.5",
      supportsTablet: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
    },
    plugins: ["expo-router", "sentry-expo"],
    extra: {
      eas: {
        projectId: "ca83fc9f-4f5a-4bda-ad14-43db8467352b",
      },
      BACKEND_URL: process.env.BACKEND_URL,
    },
  },
});
