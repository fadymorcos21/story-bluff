// app/index.jsx
// import * as Sentry from "sentry-expo";
import Constants from "expo-constants";
import { useState, useRef, useEffect } from "react";
import "expo-router/entry";
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
import { Ionicons } from "@expo/vector-icons";

// Sentry.init({
//   dsn: "https://aa2a39afffacdb421373fa04ebe21905@o4508060621209600.ingest.us.sentry.io/4509732744069120",
//   enableInExpoDevelopment: true,
//   debug: true,
// });

const BACKEND_URL =
  Constants?.expoConfig?.extra?.BACKEND_URL ??
  Constants?.manifest?.extra?.BACKEND_URL ??
  "http://localhost:5000"; // fallback if undefined
console.log(BACKEND_URL);

export default function Home() {
  const router = useRouter();

  const [username, setUsername] = useState("");

  // 1) on mount, load any saved username
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
        useNativeDriver: false,
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
            // show why user couldn’t join
            // use Alert in app production
            // Alert.alert("Error", response.error);
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

  return (
    <SafeAreaView className="flex-1 bg-transparent">
      <LinearGradient
        colors={["#1a0041", "#4c005c"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 py-7-mt-3">
          <View className="flex-[5] justify-center bg-rsed-200  items-center px-10">
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

          {/* Wrapa from here */}

          <View className="flex-[0.8] items-center bottom-28s justify-center px-10">
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
            className="flex-[0.8] justify-center left-0 px-10 bottom-28s right-0 px-10"
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
            className="flex-[0.8] jur bottom-28s left-0 px-10 right-0 pb-6"
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
                  ? "w-full rounded-2xl max-w-md h-12 bg-white/60 text-black text-center text-xl rounded-lg"
                  : "w-full rounded-full max-w-md h-12 bg-white/20 text-white text-center text-xl rounded-lg"
              }
              onFocus={() => setKeyboardVisible("username")}
              onBlur={() => setKeyboardVisible("")}
            />
          </KeyboardAvoidingView>
          {/* Wrapa to here */}

          {/* Add the buttons here */}

          <View className="flex-[0.9] justify-end pb-6 left-0 right-0 px-10">
            <View className="flex-row flex-row justify-around items-center">
              <TouchableOpacity
                onPress={() => Alert.alert("Settings")}
                className="p-3 bg-white/20 rounded-full"
              >
                <Ionicons name="settings-outline" size={24} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/my-story-book")}
                className="p-3 bg-white/20 rounded-full"
              >
                <Ionicons name="book-outline" size={24} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Alert.alert("Game Mode")}
                className="p-3 bg-white/20 rounded-full"
              >
                <Ionicons
                  name="game-controller-outline"
                  size={24}
                  color="#FFF"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
