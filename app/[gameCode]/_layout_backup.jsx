// app/[gameCode]/_layout.jsx
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
