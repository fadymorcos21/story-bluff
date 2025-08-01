// app/_layout.jsx
import "react-native-reanimated"; // FIRST import, before anything
import { Slot } from "expo-router";

export default function Layout() {
  return <Slot />;
}
