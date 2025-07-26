// app/_layout.jsx
import "./sentrySetup"; // ✅ import first
import { Slot } from "expo-router";

export default function Layout() {
  return <Slot />;
}
