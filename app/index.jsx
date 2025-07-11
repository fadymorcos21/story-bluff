// app/index.jsx
import { BACKEND_URL, TEST_MODE } from "@env";

import { useState, useRef, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Dimensions,
  StyleSheet,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { connectSocket } from "../services/socket";
import "./../global.css";

// Testing Purposes
const FEATURE_TEST_MODE = TEST_MODE?.toLowerCase() === "true";

const generateRandomUsername = (length = 6) =>
  Math.random()
    .toString(36) // turn to base-36 (0–9, a–z)
    .substring(2, 2 + length);

export default function Home() {
  const router = useRouter();

  const initialUsername = FEATURE_TEST_MODE
    ? `user_${generateRandomUsername()}`
    : "";

  const [username, setUsername] = useState(initialUsername);

  // 1) on mount, load any saved username
  useEffect(() => {
    AsyncStorage.getItem("username").then((saved) => {
      if (saved && !FEATURE_TEST_MODE) setUsername(saved);
    });
  }, []);

  const [isKeyboardVisible, setKeyboardVisible] = useState("");

  // FOR TESTNG - to remove from here
  const anim = useRef(new Animated.Value(0)).current;

  // TEST-START   - uncomment for testing
  {
    FEATURE_TEST_MODE &&
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
  }
  // TEST-END
  const [revealed, setRevealed] = useState(FEATURE_TEST_MODE ? true : false);
  const [code, setCode] = useState("");
  const [createBtnWidth, setCreateBtnWidth] = useState(null);
  const screenWidth = Dimensions.get("window").width - 32;
  const collapsedWidth = (screenWidth * 7) / 20;

  const handleCreatePress = async () => {
    if (!username.trim()) {
      return Alert.alert("Please enter a username to create a game");
    }
    try {
      await AsyncStorage.setItem("username", username);
      const res = await fetch(`${BACKEND_URL}/create`, { method: "POST" });
      const { pin } = await res.json();

      const socket = connectSocket(BACKEND_URL);
      // listen for errors / alread
      // socket.on("errorMessage", (msg) => Alert.alert("Error", msg));

      socket.emit("joinGame", { pin, username });
      router.replace(`/${pin}?user=${encodeURIComponent(username)}`);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Unable to create game. Please try again.");
    }
  };

  const handleJoinPress = async () => {
    if (!revealed) {
      setRevealed(FEATURE_TEST_MODE ? false : true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      if (!username.trim() || !code.toUpperCase().trim()) {
        return Alert.alert("Enter both username and game pin");
      }

      const socket = connectSocket(BACKEND_URL);

      await AsyncStorage.setItem("username", username);

      socket.emit(
        "joinGame",
        { pin: code.toUpperCase(), username },
        (response) => {
          if (!response.ok) {
            // show why we couldn’t join (e.g. “Game not found”)
            // use Alert in app production
            // Alert.alert("Error", response.error);
            return alert(response.error);
          }
          // ✅ only navigate when server says OK
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

  return (
    <SafeAreaView className="flex-1 bg-transparent">
      <LinearGradient
        colors={["#1a0041", "#4c005c"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 py-7 -mt-3">
          <View className="flex-1 pt-20 items-center px-10">
            <Image
              source={require("../assets/story_bluff_logo.png")}
              style={{ width: 288, height: 200, marginBottom: 32 }}
              resizeMode="contain"
            />
            <Image
              source={require("../assets/story_bluff_mascot.png")}
              style={{ width: 150, height: 150 }}
              resizeMode="contain"
            />
          </View>

          <View className="items-center bottom-28 justify-center px-10">
            <TouchableOpacity
              className="w-full max-w-md bg-blue-500 py-4 rounded-full mb-4 shadow-lg"
              onLayout={(e) => setCreateBtnWidth(e.nativeEvent.layout.width)}
              onPress={handleCreatePress}
            >
              <Text className="text-white text-center text-xl font-semibold">
                Create Game
              </Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "position" : "height"}
            keyboardVerticalOffset={Platform.select({ ios: 50, android: 0 })}
            className="left-0 px-10 bottom-28 right-0 px-10 pb-6"
            enabled={isKeyboardVisible === "code"}
          >
            <View className="w-full max-w-md h-12 mb-6 relative">
              <Animated.View
                className="absolute w-full left-0 border bg-[#0D1440] h-12 bg-black/40 rounded-full px-4 justify-center"
                style={{
                  opacity: inputOpacity,
                  backgroundColor: "#0D1440",
                  borderColor: "#1F3B7F",
                  borderWidth: 2,
                }}
              >
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="Enter code"
                  placeholderTextColor="#788FD1"
                  className="text-[#788FD1] text-xl"
                  returnKeyType="done"
                  onFocus={() => setKeyboardVisible("code")}
                  onBlur={() => setKeyboardVisible("")}
                />
              </Animated.View>
              <Animated.View
                className="absolute right-0 h-12 bg-pink-500 rounded-full shadow-lg"
                style={{ width: buttonWidth }}
              >
                <TouchableOpacity
                  className="flex-1 items-center justify-center"
                  onPress={handleJoinPress}
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-xl font-semibold">JOIN</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "position" : "height"}
            keyboardVerticalOffset={Platform.select({ ios: 50, android: 0 })}
            className="absolute bottom-10 left-0 px-10 right-0 px-4 pb-6"
            enabled={isKeyboardVisible === "username"}
          >
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Enter Username"
              placeholderTextColor={
                isKeyboardVisible === "username"
                  ? "rgba(0,0,0,0.64)"
                  : "rgba(255,255,255,0.6)"
              }
              returnKeyType="done"
              className={
                isKeyboardVisible === "username"
                  ? "w-full max-w-md h-12 bg-white/60 text-black text-center text-xl rounded-lg"
                  : "w-full max-w-md h-12 bg-white/20 text-white text-center text-xl rounded-lg"
              }
              onFocus={() => setKeyboardVisible("username")}
              onBlur={() => setKeyboardVisible("")}
            />
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
