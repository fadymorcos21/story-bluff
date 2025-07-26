// services/socket.js
import Constants from "expo-constants";
const { BACKEND_URL } = Constants.expoConfig.extra;
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

  return userId;
}

/**
 * Initialize (or reuse) a socket.io connection.
 * @param {string} url  your backend base URL,
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
 */
export async function connectSocket(gameCode, username) {
  const userId = await getUserId();

  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: false,
      auth: { userId },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      pingInterval: 60_000,
      pingTimeout: 120_000,
    });

    // only bind once
    socket.on("connect", () => {
      console.log("Socket connected/reconnected", gameCode, socket.id);
      socket.emit("joinGame", { gameCode, username });
    });
    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
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
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
