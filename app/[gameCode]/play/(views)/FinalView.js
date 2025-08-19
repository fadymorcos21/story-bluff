// app/[gameCode]/play/views/FinalView.js
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGame } from "../../../../context/GameContext";

export default function FinalView() {
  const { gameCode, user: username } = useLocalSearchParams();
  const router = useRouter();
  const { state, socket } = useGame();
  const { initialPlayers: players, scores } = state;

  useEffect(() => {
    socket.emit("resetGame", gameCode);
  }, [socket, gameCode]);

  // sort descending by score
  const sorted = [...players].sort(
    (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
  );

  // find top score and winners
  const topScore = scores[sorted[0].id] || 0;
  const winners = sorted.filter((p) => (scores[p.id] || 0) === topScore);
  const winnerText =
    winners.length === 1
      ? `${winners[0].username} WINS!`
      : `TIE BETWEEN ${winners.map((w) => w.username).join(", ")}`;

  const amIWinner = winners.some((p) => p.username === username);

  const handlePlayAgain = () => {
    socket.emit("joinGame", { gameCode, username });
    // navigate to the same lobby route as create
    router.replace(`/${gameCode}?user=${encodeURIComponent(username)}`);
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Winner line stays at top */}
      <Text style={styles.winner}>{winnerText.toUpperCase()}</Text>

      {/* Only you see one of these two */}
      <Text style={styles.congrats}>
        {amIWinner ? "CONGRATULATIONS!" : "YOU LOSE"}
      </Text>

      <Text style={styles.finalTitle}>FINAL SCOREBOARD</Text>
      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        style={styles.scoreList}
        renderItem={({ item }) => {
          const isMe = item.username === username;
          return (
            <View style={styles.scoreRow}>
              <Text style={[styles.playerName, isMe && styles.meText]}>
                {item.username}
              </Text>
              <Text style={[styles.playerScore, isMe && styles.meText]}>
                {scores[item.id] || 0}
              </Text>
            </View>
          );
        }}
      />

      <TouchableOpacity style={styles.button} onPress={handlePlayAgain}>
        <Text style={styles.buttonText}>PLAY AGAIN</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    padding: 20,
  },
  winner: {
    fontSize: 24,
    fontWeight: "600",
    color: "#fff",
    marginTop: 20,
    textAlign: "center",
  },
  congrats: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#FFC700",
    marginVertical: 12,
    textAlign: "center",
  },
  finalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#AAA",
    marginTop: 20,
    marginBottom: 8,
  },
  scoreList: {
    flex: 1,
    width: width * 0.88,
    marginBottom: 24,
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
  meText: {
    color: "#3B82F6",
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#3B82F6",
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
});
