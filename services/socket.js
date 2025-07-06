// services/socket.js
import { io } from "socket.io-client";

let socket = null;

/**
 * Initialize (or reuse) a socket.io connection.
 * @param {string} url  your backend base URL, e.g. "http://localhost:5000"
 * @param {object} opts optional io() options
 * @returns {import("socket.io-client").Socket}
 */
export function getSocket(url = "http://192.168.2.98:5000", opts = {}) {
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
export function connectSocket(url, opts) {
  const s = getSocket(url, opts);
  if (!s.connected) {
    s.connect();
  }
  return s;
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
