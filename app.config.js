// app.config.js
export default {
  name: "story-bluff",
  slug: "story-bluff",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  expo: {
    jsEngine: "jsc",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.fadymorcos21.storybluff",
    buildNumber: "1.0.18",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType:
            "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1"],
        },
      ],
    },
  },
  android: {
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
  },
  plugins: [
    "expo-router",
    "sentry-expo",
    // "./plugins/removeDuplicatePrivacyFiles",
  ],
  extra: {
    BACKEND_URL: "https://resistnce-game-srver-app.store",
    TEST_MODE: "FALSE",
    router: {},
    eas: {
      projectId: "ca83fc9f-4f5a-4bda-ad14-43db8467352b",
    },
    sentry: {
      disableProfiling: true,
    },
  },
};
