// app/[gameCode]/play/views/RevealView.js
import { BACKEND_URL, TEST_MODE } from "@env";

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
import { useLocalSearchParams } from "expo-router";
export default function RevealView() {
  // Testing
  const FEATURE_TEST_MODE = TEST_MODE?.toLowerCase() === "true";

  const { state, dispatch, socket } = useGame();

  const { gameCode, user } = useLocalSearchParams();

  const { initialPlayers: players, scores, story, authorId, round } = state;

  // Get the author username
  const authorName =
    players.find((p) => p.id === authorId)?.username.toUpperCase() || "";

  // Countdown logic
  const [countdown, setCountdown] = useState(FEATURE_TEST_MODE ? 1 : 15);
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          console.log("Requested next round");
          socket.emit("nextRound", gameCode);

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
      <View style={styles.titleContainer}>
        <Text style={styles.title}>IT WAS {authorName}</Text>
      </View>

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
      <View style={styles.scoreList}>
        <FlatList
          data={sorted}
          keyExtractor={(p) => p.id}
          // style={styles.scoreList}
          renderItem={({ item }) => {
            const isMe = item.username === user;
            return (
              <View style={styles.scoreRow}>
                <Text style={[styles.playerName, isMe && styles.meName]}>
                  {item.username}
                </Text>
                <Text style={[styles.playerScore, isMe && styles.meScore]}>
                  {scores[item.id] || 0}
                </Text>
              </View>
            );
          }}
        />
      </View>
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
  titleContainer: {
    flex: 16,
    marginTop: 5,
    marginBottom: 7,
    width: width * 0.85,
    textAlign: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#FFC700", // gold
    marginBottom: 6,
    width: width * 0.85,
    textAlign: "center",
    textAlignVertical: "center",
  },
  card: {
    flex: 20,
    width: width * 0.88,
    backgroundColor: "#FEFBEA",
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 16,
    alignItems: "center",
    position: "relative",
  },
  countdownContainer: {
    flex: 5,
    justifyContent: "center",
    fontSize: 16,
  },
  countdown: {
    color: "#AAA",
    textAlignVertical: "center",
    fontSize: 16,
  },
  scoreList: {
    flex: 18,
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
  meName: {
    color: "#3B82F6",
  },
  meScore: {
    color: "#3B82F6",
  },
});
