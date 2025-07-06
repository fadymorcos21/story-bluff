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
  const { state, dispatch, socket } = useGame();
  const { players, votes, story, scores } = state;
  const [selected, setSelected] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [showStory, setShowStory] = useState(false);

  const voteOptions = players.filter((p) => p.username !== user);

  // Who hasn't voted yet?  (only among the valid options)
  const waitingIds = voteOptions
    .map((p) => p.id)
    .filter((id) => votes[id] == null);
  const waitingName =
    voteOptions.find((p) => p.id === waitingIds[0])?.username || "";

  // When you press an option
  const handleSelect = (id) => {
    if (hasVoted) return;
    setSelected(id);
  };

  // Send your vote to the server
  const finalize = () => {
    if (!selected || hasVoted) return;
    socket.emit("vote", { pin: gameCode, choiceId: selected });
    setHasVoted(true);
    console.log("voted");
    console.log(scores);
  };

  // Render each player as a voting option
  const renderItem = ({ item }) => {
    const isSelected = item.id === selected;
    // gather all voters who chose this item
    console.log(votes);
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
        {/* {console.log(voters)} */}
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
        <Text style={styles.title}>VOTING PHASE</Text>
        <TouchableOpacity style={styles.scoreboard}>
          <Text style={styles.scoreboardText}>SCOREBOARD</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.waiting}>Waiting on {waitingName}...</Text>

      {/* card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>CAST YOUR VOTE</Text>
        <FlatList
          data={voteOptions}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          extraData={votes}
          style={styles.list}
        />

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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    flex: 8,
    backgroundColor: "#15264F",
    borderRadius: 20,
    padding: CARD_PADDING,
    width: width - 40,
  },
  title: {
    color: "#FFC700",
    fontSize: 24,
    fontWeight: "bold",
  },
  scoreboard: {
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
});
