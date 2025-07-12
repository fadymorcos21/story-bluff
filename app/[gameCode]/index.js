// app/[gameCode]/index.js
import { TEST_MODE } from "@env";
import { useEffect, useState, useRef } from "react";
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
  Keyboard,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useGame } from "../../context/GameContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const devMode = TEST_MODE?.toLowerCase() === "true";
const MAX_STORIES = 5;
const MIN_STORIES = 3;
const BOOK_KEY = "@MyStoryBook:stories";

export default function GameLobby() {
  const screenHeight = Dimensions.get("window").height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const { gameCode, user } = useLocalSearchParams();
  const router = useRouter();
  const { state, socket } = useGame();
  const { players } = state;
  const [pickerVisible, setPickerVisible] = useState(false);
  const [allStories, setAllStories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const me = players.find((p) => p.username === user) || {};
  const amHost = me.isHost;
  const iAmReady = me.ready;
  const allReady =
    players.length >= MIN_STORIES && players.every((p) => p.ready);

  const [stories, setStories] = useState(() => {
    if (devMode) return Array(MIN_STORIES).fill(`${user} `.repeat(4));
    return Array(MIN_STORIES).fill("");
  });
  const [editingIndex, setEditingIndex] = useState(null);
  const [draftText, setDraftText] = useState("");

  useEffect(() => {
    if (pickerVisible) {
      AsyncStorage.getItem(BOOK_KEY).then((json) => {
        setAllStories(json ? JSON.parse(json) : []);
      });
    }
  }, [pickerVisible]);

  const filtered = allStories.filter((s) =>
    s.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function openPicker() {
    // keep which slot we're editing, just dismiss its native Modal
    // setEditingIndex(null);
    Keyboard.dismiss();
    setSearchTerm("");
    setPickerVisible(true);
    slideAnim.setValue(screenHeight * 0.8); // start off‐screen
    Animated.timing(slideAnim, {
      toValue: 0, // slide to bottom‐aligned 0
      duration: 300,
      useNativeDriver: true,
    }).start();
  }

  function pickStory(text) {
    Alert.alert("Use this saved story?", "Insert into your current slot?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        onPress: () => {
          const next = [...stories];
          next[editingIndex] = text;
          setStories(next);
          closePicker();
          setEditingIndex(null);
        },
      },
    ]);
  }

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

  const submitStories = async () => {
    if (!socket) return Alert.alert("Error", "Not connected");
    socket.emit("submitStories", { pin: gameCode, stories });
    if (!devMode) {
      try {
        const raw = await AsyncStorage.getItem(BOOK_KEY);
        const existing = raw ? JSON.parse(raw) : [];
        const newEntries = stories.map((t, i) => ({
          id: `${gameCode}-${user}-${Date.now()}-${i}`,
          name: "",
          text: t,
        }));
        await AsyncStorage.setItem(
          BOOK_KEY,
          JSON.stringify([...newEntries, ...existing])
        );
      } catch (e) {
        console.error("Failed to cache stories:", e);
      }
    }
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

  function closePicker() {
    Animated.timing(slideAnim, {
      toValue: screenHeight, // slide down off‐screen
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setPickerVisible(false); // finally hide the overlay
    });
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient
        colors={["#1a0041", "#4c005c"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.container}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.replace("/")}
        >
          <MaterialCommunityIcons name="close" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.pinLabel}>Game PIN</Text>
          <Text style={styles.codeText}>{gameCode}</Text>
          <Text style={styles.waitingText}>Waiting for players…</Text>
        </View>

        <FlatList
          data={players}
          keyExtractor={(p) => p.id}
          renderItem={renderPlayer}
          style={{ marginBottom: 24 }}
        />

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

      <Modal visible={editingIndex !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          {/* 1) Picker overlay lives here, as a sibling to modalContent */}
          {pickerVisible && (
            <View style={styles.overlayContainer}>
              <TouchableWithoutFeedback onPress={closePicker}>
                <View style={styles.overlayBackdrop} />
              </TouchableWithoutFeedback>

              <Animated.View
                style={[
                  styles.overlayBox,
                  { transform: [{ translateY: slideAnim }] },
                ]}
              >
                <Text style={styles.overlayTitle}>📖 My Story Book</Text>

                <TextInput
                  placeholder="Search stories…"
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  style={styles.sheetSearch}
                />

                <FlatList
                  data={filtered}
                  keyExtractor={(item) => item.id}
                  style={{ marginTop: 12 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.sheetItem}
                      onPress={() => pickStory(item.text)}
                    >
                      <Text numberOfLines={2} style={styles.sheetItemText}>
                        {item.text}
                      </Text>
                    </TouchableOpacity>
                  )}
                />

                <TouchableOpacity
                  onPress={closePicker}
                  style={{ marginTop: 16, alignSelf: "flex-end" }}
                >
                  <Text style={{ color: "#2563EB", fontWeight: "600" }}>
                    Close
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}

          {/* 2) Your regular editor UI */}
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
                style={styles.modalBtn}
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={openPicker} style={styles.modalBtn}>
                <MaterialCommunityIcons
                  name="book-open-page-variant"
                  size={24}
                  color="#2563EB"
                />
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
    zIndex: -10,
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
    alignItems: "center",
    paddingTop: 12,
  },
  modalBtn: { padding: 8 },
  modalStoryBookBtn: { padding: 8, marginHorizontal: 12 },
  modalCancel: { fontSize: 16, color: "#555" },
  modalSaveButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalSaveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  modalWrapper: { flex: 1, justifyContent: "flex-end" },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetContainer: {
    width: "100%",
    height: "80%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#ccc",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetSearch: {
    height: 40,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  sheetItem: {
    paddingVertical: 12,
    borderBottomColor: "#eee",
    borderBottomWidth: 1,
  },
  sheetItemText: { fontSize: 16, color: "#333" },
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    alignItems: "center",
    zIndex: 10000,
    elevation: 10000,
  },

  overlayBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  overlayBox: {
    width: "100%",
    height: "80%", // cover 80% of screen height
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },

  overlayTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
});
