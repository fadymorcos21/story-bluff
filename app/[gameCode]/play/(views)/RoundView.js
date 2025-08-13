// app/[gameCode]/play/views/RoundView.js

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { useGame } from "../../../../context/GameContext";
import { useLocalSearchParams } from "expo-router";

// good

export default function RoundView() {
  // Testing

  const { state, socket, dispatch } = useGame();
  const { gameCode } = useLocalSearchParams();

  const { round, story } = state;
  const progress = useRef(new Animated.Value(0)).current;
  const fullWidth = Dimensions.get("window").width - 40;

  const messages = [
    "Could *you* keep a straight face?",
    "The author is among you...",
    "Don’t let your face give it away.",
    "Everyone pretend it’s not yours.",
    "Blend in. Bluff hard.",
    "Analyze every word...",
    "Who would write this?",
    "Your detective skills start now.",
    "Watch for nervous laughter...",
    "Story time with a twist.",
    "Bet you didn’t expect *that*.",
    "Somebody here lived this…",
    "Get ready to spill the beans.",
    "You’ll vote in just a moment…",
    "Reading in progress...",
    "Get familiar with the story…",
    "Stay tuned — voting starts soon.",
  ];

  // Pick one at random
  const catchPhrase = messages[Math.floor(Math.random() * messages.length)];

  useEffect(() => {
    let timeout;

    Animated.timing(progress, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();

    // Schedule vote transition separately
    timeout = setTimeout(() => {
      socket.emit("startVote", gameCode);
      dispatch({ type: "START_VOTE" });
    }, 2000);

    return () => {
      clearTimeout(timeout);
      progress.stopAnimation(); // clean up if unmounted
    };
  }, []);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, fullWidth],
  });

  return (
    <View style={styles.screen}>
      <Text style={styles.roundText}>ROUND {round}</Text>

      <View style={styles.barBackground}>
        <Animated.View style={[styles.barFill, { width: barWidth }]} />
      </View>

      <View style={styles.card}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>STORY</Text>
        </View>
        <Text style={styles.storyText}>{story}</Text>
      </View>

      <View style={styles.subtitle}>
        <Text style={styles.subtitleText}>{catchPhrase}</Text>
      </View>

      <Text style={styles.footer}>Get ready to vote…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 20,
    backgroundColor: "#1a0041",
    alignItems: "center",
  },
  roundText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#FFC700",
    marginTop: 20,
  },
  barBackground: {
    marginTop: 12,
    width: "100%",
    height: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    backgroundColor: "#7C56D9",
  },
  card: {
    width: "100%",
    backgroundColor: "#FEFBEA",
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 16,
    marginTop: 24,
    alignItems: "center",
    position: "relative",
  },
  tag: {
    position: "absolute",
    top: -20,
    backgroundColor: "#15264F",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  storyText: {
    color: "#15264F",
    fontSize: 24,
    lineHeight: 32,
    textAlign: "center",
  },
  subtitle: {
    backgroundColor: "#15264F",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  subtitleText: {
    color: "#FFF",
    fontSize: 16,
  },
  footer: {
    color: "#AAA",
    fontSize: 16,
    marginTop: 24,
  },
});
