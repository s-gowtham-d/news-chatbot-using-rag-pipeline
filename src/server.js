/**
 * This is the main server file with Socket.IO integration.
 * Handles real-time chat communication.
 * Path: src/server.js
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import chatRoutes from "./routes/chat.js";
import { createClient } from "redis";
import { retrieveRelevantDocs } from "./services/vectorService.js";
import { getStreamingResponseFromGemini } from "./services/geminiService.js";

dotenv.config();

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors({
  origin:'*',
  credentials: true
}));
app.use(express.json());

app.use("/api", chatRoutes);

app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount 
  });
});

const redis = createClient({ 
  url: process.env.REDIS_URL || "redis://localhost:6379" 
});

redis.on('error', (err) => console.error('❌ Redis error:', err));

await redis.connect();
console.log("✅ Redis connected");

io.on("connection", (socket) => {
  const sessionId = socket.handshake.query.sessionId;
  
  if (!sessionId) {
    console.error("❌ No sessionId provided");
    socket.disconnect();
    return;
  }

  console.log(`✅ Client connected: ${socket.id} | Session: ${sessionId}`);
  
  const key = `chat:${sessionId}`;

  (async () => {
    try {
      const data = await redis.get(key);
      const history = JSON.parse(data || "[]");
      
      socket.emit("history", history);
      console.log(`📜 Sent ${history.length} items to ${sessionId}`);
    } catch (err) {
      console.error("❌ Error loading history:", err);
      socket.emit("history", []);
    }
  })();

  socket.on("userMessage", async ({ content }) => {
    if (!content || !content.trim()) {
      console.log("⚠️ Empty message received");
      return;
    }

    console.log(`💬 Message from ${sessionId}: "${content}"`);

    try {
      const histData = await redis.get(key);
      const conversationHistory = JSON.parse(histData || "[]");
      
      const timestamp = new Date().toISOString();
      
      conversationHistory.push({ 
        user: content, 
        bot: "", 
        timestamp 
      });
      await redis.set(key, JSON.stringify(conversationHistory), { EX: 86400 });

      const docs = await retrieveRelevantDocs(content);
      console.log(`📚 Found ${docs.length} docs`);
      
      const context = docs.map(d => d.text).join("\n\n");

      socket.emit("streamStart");

      const previousMessages = conversationHistory.slice(0, -1); // Exclude current
      const stream = await getStreamingResponseFromGemini(
        content, 
        context, 
        previousMessages 
      );
      
      let fullResponse = "";

      for await (const chunk of stream) {
        const token = chunk.text();
        fullResponse += token;
        socket.emit("token", token);
      }

      conversationHistory[conversationHistory.length - 1].bot = fullResponse;
      await redis.set(key, JSON.stringify(conversationHistory), { EX: 86400 });
      
      socket.emit("responseEnd");
      console.log(`✅ Response complete (${fullResponse.length} chars)`);

    } catch (err) {
      console.error("❌ Error:", err);
      socket.emit("token", "Sorry, I encountered an error. Please try again.");
      socket.emit("responseEnd");
    }
  });

  socket.on("clearSession", async () => {
    try {
      await redis.del(key);
      socket.emit("history", []);
      console.log(`🗑️ Cleared session: ${sessionId}`);
    } catch (err) {
      console.error("❌ Clear error:", err);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ Client disconnected: ${socket.id} | Reason: ${reason}`);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Socket.IO ready`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await redis.quit();
  server.close();
});