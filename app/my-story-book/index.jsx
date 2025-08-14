// app/my-story-book/index.jsx
import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

const STORAGE_KEY = "@MyStoryBook:stories";

export default function MyStoryBook() {
  const router = useRouter();
  const [stories, setStories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [draftText, setDraftText] = useState("");

  // load from storage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((json) => {
      if (json) setStories(JSON.parse(json));
    });
  }, []);

  // save to storage
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
  }, [stories]);

  const addStory = () => {
    const newStory = { id: Date.now().toString(), name: "", text: "" };
    setStories((prev) => [newStory, ...prev]);
    openEditor(newStory);
  };

  const openEditor = (story) => {
    setDraftName(story.name);
    setDraftText(story.text);
    setEditing(story);
  };

  const saveStory = () => {
    setStories((prev) =>
      prev.map((s) =>
        s.id === editing.id
          ? { ...s, name: draftName.trim(), text: draftText }
          : s
      )
    );
    closeModal();
  };

  const deleteStory = (id) => {
    setStories((prev) => prev.filter((s) => s.id !== id));
  };

  const closeModal = () => {
    setEditing(null);
    setDraftName("");
    setDraftText("");
  };

  const renderItem = ({ item, index }) => {
    const title = item.name || `Story ${index + 1}`;
    return (
      <View style={styles.card}>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardPreview} numberOfLines={2}>
            {item.text || "No content yet..."}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <Pressable onPress={() => openEditor(item)} style={styles.actionBtn}>
            <Ionicons name="pencil-outline" size={20} color="#FFD700" />
          </Pressable>
          <Pressable
            onPress={() => deleteStory(item.id)}
            style={styles.actionBtn}
          >
            <Ionicons name="trash-outline" size={20} color="#FF4081" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#1a002f", "#2f004f"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.container}>
        {/* Header with back button */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back-outline" size={24} color="#FFD700" />
          </Pressable>
          <Text style={styles.header}>My Story Book</Text>
        </View>

        <FlatList
          data={stories}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={stories.length ? null : styles.emptyContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              You haven’t saved any stories yet.
            </Text>
          }
        />

        {/* Floating Add Button */}
        <Pressable onPress={addStory} style={styles.fab}>
          <LinearGradient
            colors={["#FF0080", "#FF8C00"]}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={32} color="#fff" />
          </LinearGradient>
        </Pressable>

        {/* Modal Editor */}
        <Modal visible={!!editing} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editing?.name ? "Edit Story" : "New Story"}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Title (optional)"
                placeholderTextColor="#bbb"
                value={draftName}
                onChangeText={setDraftName}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Write your story..."
                placeholderTextColor="#bbb"
                value={draftText}
                onChangeText={setDraftText}
                multiline
              />
              <View style={styles.modalActions}>
                <Pressable onPress={closeModal} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveStory} style={styles.saveBtn}>
                  <LinearGradient
                    colors={["#00E5FF", "#007AFF"]}
                    style={styles.saveGradient}
                  >
                    <Text style={styles.saveText}>Save</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  safeArea: { flex: 1, backgroundColor: "transparent" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  header: {
    fontSize: 28,
    color: "#FFD700",
    fontWeight: "bold",
    textAlign: "left",
    textShadowColor: "#FF8C00",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#bbb",
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  card: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderColor: "#551A8B",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    shadowColor: "#551A8B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    color: "#FFF",
    fontWeight: "700",
    marginBottom: 6,
  },
  cardPreview: {
    fontSize: 14,
    color: "#ccc",
  },
  cardActions: {
    flexDirection: "row",
    marginLeft: 12,
  },
  actionBtn: {
    padding: 8,
    marginLeft: 4,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF0080",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  modalBackdrop: {
    flex: 1,
    marginBottom: 122,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#2e003f",
    borderRadius: 16,
    padding: 24,
    borderColor: "#FF0080",
    borderWidth: 1,
    shadowColor: "#FF0080",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    color: "#FFD700",
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#450065",
    color: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
    borderColor: "#8A2BE2",
    borderWidth: 1,
  },
  textArea: {
    height: 140,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  cancelBtn: {
    marginRight: 20,
  },
  cancelText: {
    color: "#aaa",
    fontSize: 16,
  },
  saveBtn: {
    overflow: "hidden",
    borderRadius: 12,
  },
  saveGradient: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: "center",
  },
  saveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
