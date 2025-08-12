import React, { useState, useRef } from "react";
import {
  Animated,
  TouchableOpacity,
  TextInput,
  View,
  Text,
  Dimensions,
  StyleSheet,
} from "react-native";

/**
 * SlideRevealJoin
 *
 * A button that, on first tap, slides over to reveal an input behind it.
 * On second tap, it calls onJoin with the entered code.
 *
 * Props:
 * - onJoin(code: string): called when user taps JOIN after revealing input
 * - initialWidthOffset (number): total horizontal padding in parent container (default: 32)
 * - collapsedWidth (number): width of the JOIN pill after slide (default: 100)
 */
export default function SlideRevealJoin({
  onJoin,
  initialWidthOffset = 32,
  collapsedWidth = 100,
}) {
  const [revealed, setRevealed] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get("window").width - initialWidthOffset;
  const [code, setCode] = useState("");

  // Interpolated values
  const buttonWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenWidth, collapsedWidth],
  });
  const buttonTranslateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenWidth - collapsedWidth],
  });
  const inputWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenWidth - collapsedWidth],
  });
  const inputOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handlePress = () => {
    if (!revealed) {
      setRevealed(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      onJoin && onJoin(code);
    }
  };

  return (
    <View style={styles.container}>
      {/* Hidden input behind the button */}
      <Animated.View
        style={[
          styles.inputContainer,
          { width: inputWidth, opacity: inputOpacity },
        ]}
      >
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Enter code"
          placeholderTextColor="#ddd"
          style={styles.input}
          returnKeyType="done"
        />
      </Animated.View>

      {/* Sliding JOIN button */}
      <Animated.View
        style={{
          ...styles.joinButton,
          width: buttonWidth,
          transform: [{ translateX: buttonTranslateX }],
        }}
      >
        <TouchableOpacity
          style={styles.joinTouchable}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <Text style={styles.joinText}>JOIN</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 48,
    overflow: "hidden",
    marginBottom: 24,
  },
  inputContainer: {
    position: "absolute",
    left: 0,
    height: 48,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 24,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  input: {
    color: "#fff",
    fontSize: 16,
  },
  joinButton: {
    position: "absolute",
    right: 0,
    height: 48,
    backgroundColor: "#ff4cd8",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  joinTouchable: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  joinText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
