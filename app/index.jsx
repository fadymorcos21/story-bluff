// app/index.jsx
import Constants from "expo-constants";
import { useState, useRef, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Modal,
  Dimensions,
  StyleSheet,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { connectSocket } from "../services/socket";
import { Ionicons } from "@expo/vector-icons";

const BACKEND_URL =
  Constants?.expoConfig?.extra?.BACKEND_URL ??
  Constants?.manifest?.extra?.BACKEND_URL ??
  "https://resistnce-game-srver-app.store"; // fallback if undefined
console.log(BACKEND_URL);

export default function Home() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [isHowToPlayVisible, setHowToPlayVisible] = useState(false); // NEW

  // load saved username on mount
  useEffect(() => {
    AsyncStorage.getItem("username").then((saved) => {
      if (saved) setUsername(saved);
    });
  }, []);

  const [isKeyboardVisible, setKeyboardVisible] = useState("");

  const anim = useRef(new Animated.Value(0)).current;

  const [revealed, setRevealed] = useState(false);
  const [code, setCode] = useState("");
  const [createBtnWidth, setCreateBtnWidth] = useState(null);
  const screenWidth = Dimensions.get("window").width - 32; // ~ px-4 on each side
  const collapsedWidth =
    screenWidth < 708 ? (screenWidth * 7) / 20 : (screenWidth * 2) / 20;

  const handleCreatePress = async () => {
    if (!username.trim()) {
      return Alert.alert("Please enter a username to create a game");
    }
    try {
      await AsyncStorage.setItem("username", username);
      const res = await fetch(`${BACKEND_URL}/create`, { method: "POST" });
      const { pin } = await res.json();

      const existingUserId = await AsyncStorage.getItem("userId");
      console.log(
        `navigating user ${username} with ${existingUserId} to game ${pin}`
      );
      router.replace(`/${pin}?user=${encodeURIComponent(username)}`);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Unable to create game. Please try again.");
    }
  };

  const handleJoinPress = async () => {
    if (!revealed) {
      setRevealed(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false, // width + opacity
      }).start();
    } else {
      if (!username.trim() || !code.toUpperCase().trim()) {
        return Alert.alert("Enter both username and game pin");
      }

      const socket = await connectSocket(code);

      await AsyncStorage.setItem("username", username);

      socket.emit(
        "joinGame",
        { gameCode: code.toUpperCase(), username },
        (response) => {
          if (!response.ok) {
            return Alert.alert("Error", response.error);
          }
          router.replace(
            `/${code.toUpperCase()}?user=${encodeURIComponent(username)}`
          );
        }
      );
    }
  };

  const inputOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const buttonWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [createBtnWidth ?? 300, collapsedWidth],
  });

  const usernameActive = isKeyboardVisible === "username";

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#1a0041", "#4c005c"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* How to Play Modal */}
      <Modal
        visible={isHowToPlayVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHowToPlayVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          {/* Backdrop: tap to close */}
          <Pressable
            onPress={() => setHowToPlayVisible(false)}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />

          {/* Card: taps inside do NOT close */}
          <Pressable
            onPress={() => {}}
            style={{ width: "100%", maxWidth: 400 }}
          >
            <View
              style={{ backgroundColor: "#fff", borderRadius: 12, padding: 20 }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}
              >
                How to Play
              </Text>

              <Text
                style={{ fontSize: 16, fontWeight: "600", marginBottom: 8 }}
              >
                Goal
              </Text>
              <Text style={{ fontSize: 16, lineHeight: 24, marginBottom: 20 }}>
                Don't give it away when it’s your story. Guess who it happened
                to when it isn’t. Score points by guessing correctly—or by
                deceiving others.
              </Text>

              <Text
                style={{ fontSize: 16, fontWeight: "600", marginBottom: 8 }}
              >
                Setup
              </Text>
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 16, lineHeight: 26 }}>
                  • Set your username and join a game.
                </Text>
                <Text style={{ fontSize: 16, lineHeight: 26 }}>
                  • Add <Text style={{ fontWeight: "600" }}>3–5</Text> short
                  stories from your life.
                </Text>
                <Text style={{ fontSize: 16, lineHeight: 26 }}>
                  • Could be an{" "}
                  <Text style={{ fontWeight: "600" }}>experience</Text> or
                  something interesting that has happened to you (1–3
                  sentences).
                </Text>
              </View>

              <Text
                style={{ fontSize: 16, fontWeight: "600", marginBottom: 8 }}
              >
                Round Flow
              </Text>
              <View>
                <Text style={{ fontSize: 16, lineHeight: 26 }}>
                  • 8 Rounds (default).
                </Text>
                <Text style={{ fontSize: 16, lineHeight: 26 }}>
                  • Every round a random story will appear.
                </Text>
                <Text style={{ fontSize: 16, lineHeight: 26 }}>
                  • Players can discuss to get closer to determining whose story
                  it is.
                </Text>
                <Text style={{ fontSize: 16, lineHeight: 26 }}>
                  • Reveal the author and tally points.
                </Text>
                <Text style={{ fontSize: 16, lineHeight: 26 }}>
                  • Players are awarded +2 points for guessing correct.
                </Text>
                <Text style={{ fontSize: 16, lineHeight: 26 }}>
                  • The author gets +1 point for every player they deceive.
                </Text>
              </View>
            </View>
          </Pressable>
        </View>
      </Modal>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.screen}>
          {/* Top logo/mascot block */}
          <View style={styles.heroBlock}>
            <Image
              source={require("../assets/story_bluff_logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Image
              source={require("../assets/story_bluff_mascot.png")}
              style={styles.mascot}
              resizeMode="contain"
            />
          </View>

          {/* Create button */}
          <View style={styles.createBlock}>
            <TouchableOpacity
              style={styles.createBtnContainer}
              onLayout={(e) => setCreateBtnWidth(e.nativeEvent.layout.width)}
              onPress={handleCreatePress}
              activeOpacity={0.9}
            >
              <Text style={styles.createBtnText}>Create Game</Text>
            </TouchableOpacity>
          </View>

          {/* Join row (animated input + button) */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "position" : "height"}
            keyboardVerticalOffset={Platform.select({ ios: 50, android: 0 })}
            style={styles.joinKAV}
            enabled={isKeyboardVisible === "code"}
          >
            <View style={styles.joinRow}>
              <Animated.View
                style={[
                  styles.joinInputWrap,
                  styles.inputBorder,
                  { opacity: inputOpacity },
                ]}
              >
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="Enter code"
                  placeholderTextColor="#788FD1"
                  style={styles.codeInput}
                  returnKeyType="done"
                  onFocus={() => setKeyboardVisible("code")}
                  onBlur={() => setKeyboardVisible("")}
                />
              </Animated.View>

              <Animated.View
                style={[
                  styles.joinBtnWrap,
                  styles.shadowLg,
                  { width: buttonWidth },
                ]}
              >
                <TouchableOpacity
                  style={styles.joinBtnTouch}
                  onPress={handleJoinPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.joinBtnText}>JOIN</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>

          {/* Username input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "position" : "height"}
            keyboardVerticalOffset={Platform.select({ ios: 50, android: 0 })}
            style={styles.usernameKAV}
            enabled={usernameActive}
          >
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Enter Username"
              placeholderTextColor={
                usernameActive ? "rgba(0,0,0,0.64)" : "rgba(255,255,255,0.6)"
              }
              returnKeyType="done"
              style={[
                styles.usernameInputBase,
                usernameActive
                  ? styles.usernameInputActive
                  : styles.usernameInputInactive,
              ]}
              onFocus={() => setKeyboardVisible("username")}
              onBlur={() => setKeyboardVisible("")}
            />
          </KeyboardAvoidingView>

          {/* Bottom icon buttons */}
          <View style={styles.bottomBar}>
            <View style={styles.bottomRow}>
              {/* How to Play button (replaces settings) */}
              <TouchableOpacity
                onPress={() => setHowToPlayVisible(true)}
                style={styles.iconBtn}
              >
                <Ionicons name="help-circle-outline" size={24} color="#FFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/my-story-book")}
                style={styles.iconBtn}
              >
                <Ionicons name="book-outline" size={24} color="#FFF" />
              </TouchableOpacity>

              {/* Settings button (replaces game mode) */}
              <TouchableOpacity
                onPress={() => Alert.alert("Settings")}
                style={styles.iconBtn}
              >
                <Ionicons name="settings-outline" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const MAX_W_MD = 448;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  screen: {
    flex: 1,
    // paddingVertical: 28, // (tailwind py-7) — commented since original had a typo; leaving layout untouched
  },

  // Top block
  heroBlock: {
    flex: 5,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40, // px-10
  },
  logo: {
    width: 288,
    height: 200,
    marginBottom: 32,
  },
  mascot: {
    width: 150,
    height: 150,
  },

  // Create button area
  createBlock: {
    flex: 0.8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  createBtnContainer: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W_MD,
    backgroundColor: "#3B82F6", // blue-500
    paddingVertical: 16, // py-4
    borderRadius: 9999, // rounded-full
    marginBottom: 16,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  createBtnText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 20, // text-xl
    fontWeight: "600",
  },

  // Join row (animated)
  joinKAV: {
    flex: 0.8,
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  joinRow: {
    width: "100%",
    maxWidth: MAX_W_MD,
    height: 48, // h-12
    marginBottom: 24, // mb-6
    position: "relative",
    alignSelf: "center",
  },
  joinInputWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: "#0D1440",
    borderRadius: 9999,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  inputBorder: {
    borderColor: "#1F3B7F",
    borderWidth: 2,
  },
  codeInput: {
    color: "#788FD1",
    fontSize: 20, // text-xl
  },
  joinBtnWrap: {
    position: "absolute",
    right: 0,
    height: 48,
    backgroundColor: "#ec4899", // pink-500
    borderRadius: 9999,
  },
  joinBtnTouch: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  joinBtnText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },

  // Username input block
  usernameKAV: {
    flex: 0.8,
    paddingHorizontal: 40,
    paddingBottom: 24, // pb-6 (keeps spacing consistent)
    justifyContent: "center",
  },
  usernameInputBase: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MAX_W_MD,
    height: 48,
    textAlign: "center",
    fontSize: 20,
  },
  usernameInputActive: {
    backgroundColor: "rgba(255,255,255,0.60)",
    color: "#000",
    borderRadius: 16, // rounded-2xl-ish
  },
  usernameInputInactive: {
    backgroundColor: "rgba(255,255,255,0.20)",
    color: "#FFF",
    borderRadius: 9999, // rounded-full
  },

  // Bottom bar
  bottomBar: {
    flex: 0.9,
    justifyContent: "flex-end",
    paddingBottom: 24, // pb-6
    paddingHorizontal: 40, // px-10
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  iconBtn: {
    padding: 12, // p-3
    backgroundColor: "rgba(255,255,255,0.20)",
    borderRadius: 9999,
  },

  // shared shadow (used on JOIN)
  shadowLg: {
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
});
