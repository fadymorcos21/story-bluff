// App.js
import "react-native-reanimated";
import { View, Text } from "react-native";
import { registerRootComponent } from "expo";
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

export default function App() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>App is launching — no Router yet!</Text>
    </View>
  );
}
registerRootComponent(App);
