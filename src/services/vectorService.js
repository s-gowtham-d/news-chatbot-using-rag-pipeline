/**
 * Vector Service
 * Manages Qdrant connection and document retrieval
 * Handles embedding generation and similarity search
 * Uses Jina Embeddings API for generating embeddings
 * Uses Qdrant as the vector database
 */

import { QdrantClient } from '@qdrant/qdrant-js';
import axios from "axios";
import dotenv from 'dotenv';

dotenv.config();

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
  https: true
});

(async () => {
  try {
    const collections = await qdrant.getCollections();
    console.log("✅ Connected to Qdrant. Collections:", collections.collections.map(c => c.name));
  } catch (err) {
    console.error("❌ Qdrant connection failed:", err, err.message);
  }
})();

/**
 * Helper function: Generate embedding for a query
 */
export const getQueryEmbedding = async (query) => {
  try {
    const res = await axios.post(
      "https://api.jina.ai/v1/embeddings",
      { 
        input: [query],
        model: "jina-embeddings-v3",
        task: "text-matching"
      },
      { 
        headers: { 
          Authorization: `Bearer ${process.env.JINA_API_KEY}`,
          'Content-Type': 'application/json'
        } 
      }
    );
    return res.data.data[0].embedding;
  } catch (err) {
    console.error("❌ Failed to get query embedding:", err.response?.data || err.message);
    throw err;
  }
};

/**
 * Build enhanced query with conversation context
 */
const buildEnhancedQuery = (currentQuery, conversationHistory = []) => {
  // Keywords that indicate follow-up questions
  const followUpIndicators = [
    'more', 'tell me more', 'elaborate', 'details', 'explain',
    'what about', 'how about', 'links', 'source', 'article',
    'continue', 'go on', 'expand', 'list', 'show me',
    'another', 'other', 'else', 'different'
  ];
  
  const lowerQuery = currentQuery.toLowerCase();
  const isFollowUp = followUpIndicators.some(indicator => lowerQuery.includes(indicator));
  
  // If it's a follow-up question and we have history
  if (isFollowUp && conversationHistory.length > 0) {
    // Get last 3 user queries for context
    const recentQueries = conversationHistory
      .slice(-3)
      .map(h => h.user)
      .filter(q => q && q.trim());
    
    // Combine current query with recent context
    const enhancedQuery = [...recentQueries, currentQuery].join(' ');
    console.log(`🔍 Enhanced query (follow-up detected): "${enhancedQuery}"`);
    return enhancedQuery;
  }
  
  console.log(`🔍 Original query (new topic): "${currentQuery}"`);
  return currentQuery;
};

/**
 * Retrieve top-k most relevant docs from Qdrant with context awareness
 */
export const retrieveRelevantDocs = async (query, conversationHistory = []) => {
  try {
    // Build context-aware query
    const enhancedQuery = buildEnhancedQuery(query, conversationHistory);

    const lastTurn = conversationHistory.at(-1);
    if (lastTurn && /first|second|that|it|more|details|about|above/i.test(query)) {
      if (lastTurn.relevantDocs?.length) {
        console.log("💾 Using cached docs from previous turn");
        return lastTurn.relevantDocs;
      }
    }
    
    // Get embedding for enhanced query
    const queryEmbedding = await getQueryEmbedding(enhancedQuery);

    // Search Qdrant
    const searchResults = await qdrant.search("news", {
      vector: queryEmbedding,
      limit: 5, 
      with_payload: true,
      // score_threshold: 0.3,
    });

    console.log(`🎯 Retrieved ${searchResults.length} documents (threshold: 0.3)`);

    // Return array of documents
    return searchResults.map((s) => ({
      text: s.payload.text,
      score: s.score,
      title: s.payload.title || '',
      link: s.payload.link || ''
    }));
    
  } catch (err) {
    console.error("❌ Qdrant search failed:", err.message);
    return [];
  }
};

/**
 * Determine response mode based on query intent
 */
export const analyzeQueryIntent = (query) => {
  const lowerQuery = query.toLowerCase();
  
  // Check for different intents
  const intents = {
    wantsList: /\b(list|show|give me|get|find)\b.*\b(news|articles|stories)\b/i.test(lowerQuery),
    wantsLinks: /\b(link|url|source|article|read more)\b/i.test(lowerQuery),
    wantsDetails: /\b(more|detail|elaborate|explain|tell me more|expand)\b/i.test(lowerQuery),
    wantsSummary: /\b(summary|summarize|brief|overview|quick)\b/i.test(lowerQuery),
  };
  
  if (intents.wantsLinks) return 'links';
  if (intents.wantsDetails) return 'details';
  if (intents.wantsSummary) return 'summary';
  if (intents.wantsList) return 'list';
  
  return 'general';
};