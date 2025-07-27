// sentrySetup.js
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://aa2a39afffacdb421373fa04ebe21905@o4508060621209600.ingest.us.sentry.io/4509732744069120",
  enableNative: true,
  enableNativeNagger: true,
  tracesSampleRate: 1.0,
  _experiments: {
    profilesSampleRate: 0,
  },
});
