import "react-native-reanimated"; // still first!
import { useState } from "react";
import { View, Text, Button } from "react-native";
import { registerRootComponent } from "expo";

// 👇 Preload the router statically
import Router from "./app/router";

function App() {
  const [showRouter, setShowRouter] = useState(false);

  return showRouter ? (
    <Router />
  ) : (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Manual App Entry — No Router Yet</Text>
      <Button title="Enter Router" onPress={() => setShowRouter(true)} />
    </View>
  );
}

registerRootComponent(App);
export default App;
