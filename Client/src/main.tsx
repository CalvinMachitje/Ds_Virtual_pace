// Entry point of the React application
// Client/src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import React from 'react';
import { AuthProvider } from "./context/AuthContext.tsx";

createRoot(document.getElementById("root")!).render(
    //<React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  //</React.StrictMode>
);

// ──────────────────────────────────────────────
// Socket.IO Client Setup (added below your render)
// ──────────────────────────────────────────────
import { io } from "socket.io-client";

// Create socket instance with proper config
const socket = io("http://196.253.26.123:5000/", {
  withCredentials: true,               // required for CORS cookies
  transports: ["websocket", "polling"], // prefer websocket, fallback to polling
  reconnection: true,                   // auto-reconnect on disconnect
  reconnectionAttempts: 5,              // try 5 times
  reconnectionDelay: 1000,              // 1s delay between attempts
  timeout: 20000,                       // 20s connection timeout
  auth: {
    token: localStorage.getItem("access_token") || ""
  }
});

// ──────────────────────────────────────────────
// Socket event listeners (added for debugging & reliability)
// ──────────────────────────────────────────────
socket.on("connect", () => {
  console.log("Socket connected! ID:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("Socket connection error:", err.message);
});

socket.on("disconnect", (reason) => {
  console.warn("Socket disconnected:", reason);
  if (reason === "io server disconnect") {
    // Server forced disconnect → try reconnect manually
    socket.connect();
  }
});

socket.on("error", (err) => {
  console.error("Socket error:", err.message);
});

// Optional: Handle token refresh / re-auth (if your backend supports it)
socket.on("auth_required", () => {
  console.warn("Socket requires new auth token");
  // You can emit a refresh token event or redirect to login
socket.emit("refresh_token", { token: localStorage.getItem("refresh_token") });
});

// Export socket so other components can import & use it
export { socket };