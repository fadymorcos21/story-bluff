// app/index.jsx
import { View, Text } from "react-native";
import "react-native-reanimated"; // FIRST import, before anything

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Expo Router: Minimal Index</Text>
    </View>
  );
}
