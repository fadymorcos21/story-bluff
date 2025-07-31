import "react-native-reanimated"; // ✅ MUST be first
import { registerRootComponent } from "expo";

import { View, Text } from "react-native";

// Quick loading screen while we register the real app
const App = () => (
  <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
    <Text>Booting...</Text>
  </View>
);

// ✅ Register a shell, then hand off to Router after a short delay
registerRootComponent(App);
setTimeout(() => {
  require("expo-router/entry");
}, 1000); // you can increase if needed
