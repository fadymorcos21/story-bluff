// app/[gameCode]/play/index.jsx
import { useGame } from "../../../context/GameContext";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  Animated,
  Dimensions,
  StyleSheet,
} from "react-native";
import RevealView from "./(views)/RevealView";
import RoundView from "./(views)/RoundView";
import VoteView from "./(views)/VoteView";
import FinalView from "./(views)/FinalView";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";

export default function Play() {
  const { state, user, gameCode } = useGame();
  const router = useRouter();
  console.log(`[PLAY ${state.phase}] rendering phase`, state.phase);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (state.phase === "LOBBY") {
      router.replace(`/${gameCode}?user=${encodeURIComponent(user)}`);
    }
  }, [mounted, state.phase, gameCode, user]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#1a0041", "#4c005c"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {(() => {
        switch (state.phase) {
          case "ROUND":
            return <RoundView />;
          case "VOTE":
            return <VoteView />;
          case "REVEAL":
            return <RevealView />;
          case "FINAL":
            return <FinalView />;
          default:
            return <Text style={{ color: "red" }}>The White Screen Error</Text>;
        }
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
