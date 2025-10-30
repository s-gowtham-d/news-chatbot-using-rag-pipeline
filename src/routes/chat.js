/**
 * Chat Routes
 * Defines API endpoints for chat functionality
 * Uses Redis service for session and history management
 * Handles chat requests and session management
 * Path: src/routes/chat.js
 */
import express from "express";
import { handleChat, getHistory, clearSession } from "../services/redisService.js";

const router = express.Router();

// POST /api/chat
router.post("/chat", handleChat);

// GET /api/history/:sessionId
router.get("/history/:sessionId", getHistory);

// DELETE /api/history/:sessionId
router.delete("/history/:sessionId", clearSession);

export default router;
