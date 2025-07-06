// app/[gameCode]/index.js
import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useGame } from "../../context/GameContext";

const MAX_STORIES = 5;
const MIN_STORIES = 3;

export default function GameLobby() {
  const { gameCode, user } = useLocalSearchParams();
  const router = useRouter();
  const { state, socket } = useGame();
  const { players } = state;

  // figure out current user & host / ready states
  const me = players.find((p) => p.username === user) || {};
  const amHost = me.isHost;
  const iAmReady = me.ready;
  const allReady = players.length >= 3 && players.every((p) => p.ready);

  // story input state
  // const [stories, setStories] = useState(
  //   Array(MIN_STORIES).fill(`${me.username}`) //For testing
  // );

  // uncomment later^

  // temporary
  const [stories, setStories] = useState([]);

  useEffect(() => {
    if (me?.username && stories.length === 0) {
      setStories(Array(MIN_STORIES).fill(`${me.username} `.repeat(4)));
    }
  }, [me, stories.length]);
  // temporary

  const [editingIndex, setEditingIndex] = useState(null);
  const [draftText, setDraftText] = useState("");

  const openEditor = (idx) => {
    setDraftText(stories[idx]);
    setEditingIndex(idx);
  };
  const saveEditor = () => {
    const next = [...stories];
    next[editingIndex] = draftText;
    setStories(next);
    setEditingIndex(null);
  };
  const addStory = () => {
    if (stories.length < MAX_STORIES) setStories([...stories, ""]);
  };
  const removeStory = () => {
    if (stories.length > MIN_STORIES)
      setStories((prev) => prev.slice(0, prev.length - 1));
  };

  const submitStories = () => {
    if (!socket) return Alert.alert("Error", "Not connected");
    socket.emit("submitStories", { pin: gameCode, stories });
  };

  const startGame = () => {
    if (!socket) return Alert.alert("Error", "Not connected");
    socket.emit("startGame", gameCode);
  };

  const renderPlayer = ({ item }) => (
    <View style={styles.playerRow}>
      <MaterialCommunityIcons
        name={item.isHost ? "crown" : "account"}
        size={28}
        color={item.ready ? "limegreen" : "#F0EAD6"}
        style={{ marginRight: 8 }}
      />
      <Text style={[styles.playerName, item.ready && { color: "limegreen" }]}>
        {item.username}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient
        colors={["#1a0041", "#4c005c"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.container}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.replace("/")}
        >
          <MaterialCommunityIcons name="close" size={24} color="#FFF" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pinLabel}>Game PIN</Text>
          <Text style={styles.codeText}>{gameCode}</Text>
          <Text style={styles.waitingText}>Waiting for players…</Text>
        </View>

        {/* Player list with ready state */}
        <FlatList
          data={players}
          keyExtractor={(p) => p.id}
          renderItem={renderPlayer}
          style={{ marginBottom: 24 }}
        />

        {/* If I haven't submitted, show story inputs; otherwise show waiting / start */}
        {!iAmReady ? (
          <>
            <Text style={styles.sectionTitle}>
              Your Stories ({MIN_STORIES} required):
            </Text>
            {stories.map((story, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.storySlot}
                onPress={() => openEditor(idx)}
                activeOpacity={0.8}
              >
                <Text style={styles.storyText}>
                  {story || `${idx + 1}. Tap to enter story`}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.storyButtonsRow}>
              {stories.length < MAX_STORIES && (
                <TouchableOpacity onPress={addStory} style={styles.addButton}>
                  <MaterialCommunityIcons
                    name="plus"
                    size={20}
                    color="#FFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              )}
              {stories.length > MIN_STORIES && (
                <TouchableOpacity
                  onPress={removeStory}
                  style={styles.addButton}
                >
                  <MaterialCommunityIcons
                    name="minus"
                    size={20}
                    color="#FFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.addButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={submitStories}
              disabled={stories.filter((s) => s.trim()).length < MIN_STORIES}
              style={[
                styles.submitButton,
                stories.filter((s) => s.trim()).length < MIN_STORIES && {
                  opacity: 0.5,
                },
              ]}
            >
              <Text style={styles.submitText}>SUBMIT STORIES</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "#fff", marginBottom: 12 }}>
              {amHost
                ? allReady
                  ? "All set! Start the game."
                  : "Waiting for players…"
                : "Waiting for host…"}
            </Text>
            {amHost && allReady && (
              <TouchableOpacity onPress={startGame} style={styles.submitButton}>
                <Text style={styles.submitText}>START GAME</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Story editor modal */}
      <Modal visible={editingIndex !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Story {editingIndex + 1}</Text>
            <TextInput
              value={draftText}
              onChangeText={setDraftText}
              placeholder="Type your story…"
              multiline
              style={styles.modalInput}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setEditingIndex(null)}
                style={{ marginRight: 12 }}
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEditor}
                style={styles.modalSaveButton}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { alignItems: "center", marginBottom: 32 },
  pinLabel: {
    fontSize: 16,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  codeText: { fontSize: 52, fontWeight: "bold", color: "#ccc" },
  waitingText: { fontSize: 16, color: "#aaa", marginTop: 4 },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  playerName: { fontSize: 18, color: "#fff" },
  sectionTitle: { color: "#fff", fontSize: 18, marginBottom: 12 },
  storySlot: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  storyText: { color: "#fff", fontSize: 16 },
  storyButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    paddingHorizontal: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  addButtonText: { color: "#fff", fontSize: 16 },
  submitButton: {
    backgroundColor: "#2563EB",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  submitText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 12 },
  modalInput: {
    height: 120,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  modalCancel: { fontSize: 16, color: "#555" },
  modalSaveButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalSaveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
