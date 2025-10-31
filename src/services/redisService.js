/**
 * Redis Service
 * Manages chat sessions and history using Redis
 * Handles chat requests and session management
 */
import { createClient } from "redis";
import { v4 as uuidv4 } from "uuid";
import { getResponseFromGemini } from "./geminiService.js";
import { retrieveRelevantDocs } from "./vectorService.js";
import dotenv from 'dotenv';
import { text } from "express";

dotenv.config();
const client = createClient({ url: process.env.REDIS_URL });
await client.connect();

client.on('error', (err) => console.error('❌ Redis Client Error', err));

// export const handleChat = async (req, res) => {
//   try {
//     let { sessionId, query } = req.body;
    
//     if (!query || query.trim() === '') {
//       return res.status(400).json({ error: "Query is required" });
//     }
    
//     if (!sessionId) {
//       sessionId = uuidv4();
//       console.log(`📝 New session created: ${sessionId}`);
//     }

//     console.log(`💬 Query from session ${sessionId}: "${query}"`);

//     const historyKey = `chat:${sessionId}`;
//     const histData = await client.get(historyKey);
//     const conversationHistory = JSON.parse(histData || "[]");

//     const docs = await retrieveRelevantDocs(query);
//     console.log(`📚 Found ${docs.length} relevant documents`);

//     const context = docs.map(d => d.text).join("\n\n");

//     const response = await getResponseFromGemini(query, context, conversationHistory);
//     console.log(`🤖 Generated response (${response.length} chars)`);

//     conversationHistory.push({ 
//       user: query, 
//       bot: response,
//       timestamp: new Date().toISOString()
//     });
//     await client.set(historyKey, JSON.stringify(conversationHistory), { EX: process.env.REDIS_TTL || 86400 });

//     res.json({ sessionId, response, documentsFound: docs.length });
//   } catch (err) {
//     console.error('❌ Chat error:', err);
//     res.status(500).json({ 
//       error: "Server error", 
//       message: err.message 
//     });
//   }
// };
export const handleChat = async (req, res) => {
  try {
    let { sessionId, query } = req.body;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({ error: "Query is required" });
    }
    
    if (!sessionId) {
      sessionId = uuidv4();
      console.log(`📝 New session created: ${sessionId}`);
    }

    console.log(`💬 Query from session ${sessionId}: "${query}"`);

    // Get conversation history
    const historyKey = `chat:${sessionId}`;
    const histData = await client.get(historyKey);
    const conversationHistory = JSON.parse(histData || "[]");

    // Retrieve documents with context
    const docs = await retrieveRelevantDocs(query, conversationHistory);
    console.log(`📚 Found ${docs.length} relevant documents`);

    if (!Array.isArray(docs)) {
      console.error("❌ retrieveRelevantDocs did not return an array:", docs);
      return res.status(500).json({ error: "Internal error retrieving documents" });
    }

    const context = docs.map(d => d.text).join("\n\n");

    // Get response
    const response = await getResponseFromGemini(query, context, conversationHistory, docs);
    console.log(`🤖 Generated response (${response.length} chars)`);

    // console.log(docs);
    // Store in history
    conversationHistory.push({ 
      user: query, 
      bot: response,
      relevantDocs: docs.map((d, i) => ({ id: i+1, title: d.title, link: d.link, text: d.text })),
      timestamp: new Date().toISOString()
    });
    await client.set(historyKey, JSON.stringify(conversationHistory), { 
      EX: parseInt(process.env.REDIS_TTL) || 86400 
    });

    res.json({ sessionId, response, documentsFound: docs.length });
    
  } catch (err) {
    console.error('❌ Chat error:', err);
    res.status(500).json({ 
      error: "Server error", 
      message: err.message 
    });
  }
};
export const getHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = JSON.parse((await client.get(`chat:${sessionId}`)) || "[]");
    res.json(history);
  } catch (err) {
    console.error('❌ Get history error:', err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
};

export const clearSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    await client.del(`chat:${sessionId}`);
    console.log(`🗑️  Cleared session: ${sessionId}`);
    res.json({ cleared: true });
  } catch (err) {
    console.error('❌ Clear session error:', err);
    res.status(500).json({ error: "Failed to clear session" });
  }
};