// app/[gameCode]/play/views/VoteView.js
import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useGame } from "../../../../context/GameContext";

export default function VoteView() {
  const { gameCode, user } = useLocalSearchParams();
  const { state, socket, userId } = useGame();
  const { initialPlayers: players, votes, story, scores } = state;
  const [selected, setSelected] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const toggleScores = () => setShowScores((prev) => !prev);

  const voteOptions = state.initialPlayers.filter((p) => p.id !== userId);

  const waitingName = "players";

  const handleSelect = (id) => {
    if (hasVoted) return;
    setSelected(id);
  };

  const finalize = () => {
    if (!selected || hasVoted) return;
    socket.emit("vote", { pin: gameCode, choiceId: selected });
    setHasVoted(true);
  };

  // Render each player as a voting option
  const renderItem = ({ item }) => {
    const isSelected = item.id === selected;
    // gather all voters who chose this item
    const voters = Object.entries(votes)
      .filter(([, choiceId]) => choiceId === item.id)
      .map(([voterId]) => {
        const p = players.find((p) => p.id === voterId);
        return p ? p.username.charAt(0).toUpperCase() : "";
      });

    return (
      <TouchableOpacity
        onPress={() => handleSelect(item.id)}
        disabled={hasVoted}
        style={[
          styles.option,
          isSelected && styles.optionSelected,
          hasVoted && styles.optionDisabled,
        ]}
      >
        <Text
          style={[styles.optionText, isSelected && styles.optionTextSelected]}
        >
          {item.username}
        </Text>
        {console.log(
          "renderItem for",
          item.id,
          "votes entries:",
          votes,
          "matching:",
          Object.entries(votes).filter(([, cid]) => cid === item.id)
        )}
        <View style={styles.voteIcons}>
          {voters.map((letter, i) => (
            <View key={i} style={styles.voteIcon}>
              <Text style={styles.voteIconText}>{letter}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* header */}
      <View style={styles.header}>
        <Text style={styles.title}>ROUND {state.round} VOTING PHASE</Text>
        <TouchableOpacity style={styles.scoreboard} onPress={toggleScores}>
          <Text style={styles.scoreboardText}>
            {showScores ? "BACK TO VOTE" : "SCOREBOARD"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* card */}
      {!showScores && (
        <>
          <Text style={styles.waiting}>Waiting on {waitingName}...</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>CAST YOUR VOTE</Text>
            <FlatList
              data={voteOptions}
              keyExtractor={(p) => p.id}
              renderItem={renderItem}
              extraData={votes}
              style={styles.list}
            />
            {console.log("vote options", voteOptions)}

            <Text style={styles.youAre}>
              {selected
                ? `You ${!hasVoted ? "are voting" : "have voted"} ${players.find((p) => p.id === selected)?.username}`
                : ""}
            </Text>

            <TouchableOpacity
              onPress={finalize}
              disabled={!selected || hasVoted}
              style={[styles.finalize, !selected && { opacity: 0.5 }]}
            >
              <Text style={styles.finalizeText}>
                {hasVoted ? "VOTE SUBMITTED" : "FINALIZE"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {showScores && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>LEADERBOARD</Text>

          <FlatList
            data={players}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => {
              const isYou = item.username === user;
              return (
                <View style={styles.scoreRow}>
                  <Text
                    style={[styles.playerName, isYou && styles.currentUserText]}
                  >
                    {item.username}
                  </Text>
                  <Text
                    style={[
                      styles.playerScore,
                      isYou && styles.currentUserText,
                    ]}
                  >
                    {scores[item.id] || 0}
                  </Text>
                </View>
              );
            }}
          />
          {console.log("PLayer List", players)}
        </View>
      )}

      {!showStory ? (
        <View style={styles.showStoryBtnView}>
          <TouchableOpacity
            onPress={() => setShowStory(true)}
            style={styles.showStory}
          >
            <Text style={styles.showStoryText}>SHOW STORY</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.storyPanel}>
          <View style={styles.storyBoard}>
            <ScrollView contentContainerStyle={styles.storyScroll}>
              <Text style={styles.storyText}>{story}</Text>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowStory(false)}
              style={styles.showStory}
            >
              <Text style={styles.showStoryText}>Hide</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");
const CARD_PADDING = 20;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#1a0041",
    // justifyContent: "space-around",
    alignItems: "center",
    padding: 20,
  },
  header: {
    flex: 4,
    flexDirection: "col",
    justifyContent: "center",
    alignItems: "center",
    width: width * 0.83,
    // marginVertical: 20,
  },
  waiting: {
    flex: 1,
    color: "#AAA",
    fontSize: 16,
    textAlign: "center",
    // marginVertical: 12,
  },
  card: {
    flex: 11,
    backgroundColor: "#15264F",
    borderRadius: 20,
    padding: CARD_PADDING,
    width: width * 0.83,
  },
  title: {
    color: "#FFC700",
    fontSize: 24,
    fontWeight: "bold",
    paddingTop: 15,
    paddingBottom: 10,
  },
  scoreboard: {
    marginTop: 5,
    borderColor: "#FFC700",
    borderWidth: 2,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  scoreboardText: {
    color: "#FFC700",
    fontSize: 14,
    fontWeight: "600",
  },

  cardTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  list: {
    marginBottom: 16,
  },

  option: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionSelected: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  optionText: {
    color: "#FFF",
    fontSize: 16,
  },
  optionTextSelected: {
    color: "#FFF",
    fontWeight: "600",
  },

  voteIcons: {
    flexDirection: "row",
    marginLeft: 8,
  },
  voteIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFC700",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -8,
  },
  voteIconText: {
    color: "#15264F",
    fontSize: 14,
    fontWeight: "bold",
  },

  youAre: {
    color: "#FFF",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 12,
  },
  finalize: {
    backgroundColor: "#FF2E63",
    borderRadius: 24,
    paddingVertical: 12,
  },
  finalizeText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },

  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomColor: "rgba(255,255,255,0.1)",
    borderBottomWidth: 1,
  },
  playerName: { color: "#FFF", fontSize: 16 },
  playerScore: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  optionDisabled: {
    // visually dim locked-in options
    opacity: 0.5,
  },
  showStoryBtnView: {
    flex: 4,
    padding: 12,
    // backgroundColor: "red",
  },
  showStory: {
    marginTop: 24,
    alignSelf: "center",
    backgroundColor: "#3B82F6",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  showStoryText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  // story panel styling
  storyPanel: {
    flex: 4,
    padding: 16,
  },

  storyBoard: {
    padding: 12,
    backgroundColor: "#FEFBEA",
    borderRadius: 16,
  },
  storyScroll: {
    // center content if short
    justifyContent: "center",
    padding: 12,
  },
  storyText: {
    color: "#15264F",
    fontSize: 16,
    lineHeight: 22,
  },
  currentUserText: {
    color: "#19bbe3", // light-blue for “you”
  },
});
