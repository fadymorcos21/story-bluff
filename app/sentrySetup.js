// sentrySetup.js
import * as Sentry from "sentry-expo";
import Constants from "expo-constants";

Sentry.init({
  dsn: "https://aa2a39afffacdb421373fa04ebe21905@o4508060621209600.ingest.us.sentry.io/4509732744069120",
  enableInExpoDevelopment: true,
  debug: true,
  // environment: Constants?.expoConfig?.extra?.env ?? "production",
});
