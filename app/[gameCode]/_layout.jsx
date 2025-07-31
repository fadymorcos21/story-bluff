// app/[gameCode]/_layout.jsx
import "react-native-reanimated"; // FIRST import, before anything
import React from "react";
import { Slot } from "expo-router";
import { GameProvider } from "../../context/GameContext";

export default function GameLayout() {
  return (
    <GameProvider>
      <Slot />
    </GameProvider>
  );
}
