// services/socket.js
import { BACKEND_URL } from "@env";
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { nanoid } from "nanoid/non-secure";

let socket = null;

/**
 * Ensures we have a persistent userId in AsyncStorage.
 */
async function getUserId() {
  let userId = await AsyncStorage.getItem("userId");
  if (!userId) {
    console.log("Setting");
    userId = nanoid();
    await AsyncStorage.setItem("userId", userId);
  }
  // AsyncStorage.removeItem("userId")
  //   .then(() => console.log("userId removed"))
  //   .catch((err) => console.error("Failed to remove userId:", err));
  return userId;
}

/**
 * Initialize (or reuse) a socket.io connection.
 * @param {string} url  your backend base URL, e.g. "http://localhost:5000"
 * @param {object} opts optional io() options
 * @returns {import("socket.io-client").Socket}
 */
export function getSocket(url = BACKEND_URL, opts = {}) {
  if (!socket) {
    socket = io(url, {
      autoConnect: false,
      transports: ["websocket"],
      ...opts,
    });
  }
  return socket;
}

/**
 * Connect the socket (if not already connected).
 * Call once on app startup or when you have your gameCode & user ready.
 */
export async function connectSocket(url = BACKEND_URL, opts = {}) {
  const userId = await getUserId();

  if (!socket) {
    socket = io(url, {
      autoConnect: false,
      transports: ["websocket"],
      ...opts,
    });
  } else {
    socket.auth = { userId };
  }

  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

/**
 * Disconnect (and clear) the socket.
 * Call on cleanup or when user leaves.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
