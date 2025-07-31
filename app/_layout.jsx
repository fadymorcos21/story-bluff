// app/_layout.jsx
import "react-native-reanimated"; // first import
import { Slot } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text } from "react-native";

export default function Layout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100); // ⏱️ delay router
    return () => clearTimeout(t);
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return <Slot />;
}
