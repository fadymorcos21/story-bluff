// app/[gameCode]/play/views/RevealView.js
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  FlatList,
  SafeAreaView,
} from "react-native";
import { useGame } from "../../../../context/GameContext";

export default function RevealView() {
  const { state, dispatch } = useGame();
  const { players, scores, story, authorId } = state;
  const fullWidth = Dimensions.get("window").width - 40; // for card

  // Get the author username
  const authorName =
    players.find((p) => p.id === authorId)?.username.toUpperCase() || "";

  // Countdown logic
  const [countdown, setCountdown] = useState(15);
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          // dispatch({ type: "NEXT_ROUND" });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sort scoreboard descending
  const sorted = [...players].sort(
    (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
  );

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <Text style={styles.title}>IT WAS {authorName}</Text>

      {/* Story card */}
      <View style={styles.card}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>STORY</Text>
        </View>
        <Text style={styles.storyText}>{story}</Text>
      </View>

      {/* Countdown */}
      <View style={styles.countdownContainer}>
        <Text style={styles.countdown}>
          Next round starting in {countdown}…
        </Text>
      </View>

      {/* Scoreboard */}
      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        style={styles.scoreList}
        renderItem={({ item }) => (
          <View style={styles.scoreRow}>
            <Text style={styles.playerName}>{item.username}</Text>
            <Text style={styles.playerScore}>{scores[item.id] || 0}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#1a0041",
    alignItems: "center",
    padding: 20,
  },
  title: {
    flex: 1,
    fontSize: 42,
    fontWeight: "bold",
    color: "#FFC700", // gold
    marginTop: 44,
    marginBottom: 6,
    width: width * 0.85,
    textAlign: "center",
  },
  card: {
    flex: 4,
    width: width * 0.88,
    backgroundColor: "#FEFBEA",
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 16,
    alignItems: "center",
    position: "relative",
  },
  countdownContainer: {
    flex: 1,
    justifyContent: "center",
    fontSize: 16,
    marginVertical: 20,
  },
  countdown: {
    color: "#AAA",
    textAlignVertical: "center",
    fontSize: 16,
  },
  scoreList: {
    flex: 4,
    width: width * 0.88,
    marginBottom: 32,
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
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomColor: "rgba(255,255,255,0.1)",
    borderBottomWidth: 1,
  },
  playerName: {
    color: "#FFF",
    fontSize: 18,
  },
  playerScore: {
    color: "#AAA",
    fontSize: 18,
  },
});
