/**
 * Vector Service
 * Manages Qdrant connection and document retrieval
 * Handles embedding generation and similarity search
 * Uses Jina Embeddings API for generating embeddings
 * Uses Qdrant as the vector database
 */
import {QdrantClient} from '@qdrant/qdrant-js';
import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
  https: true
});

// Sanity check connection
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
 * (using Jina embeddings API or any model you choose)
 */
export const getQueryEmbedding = async (query) => {
  try {
    const res = await axios.post(
      "https://api.jina.ai/v1/embeddings",
      { 
        input: [query],  // Changed to array format
        model: "jina-embeddings-v3",
        task: "text-matching"  // ADD THIS
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
 * Retrieve top-k most relevant docs from Qdrant
 */
export const retrieveRelevantDocs = async (query) => {
  try {
    const queryEmbedding = await getQueryEmbedding(query);

    const searchResults = await qdrant.search("news", {
      vector: queryEmbedding,
      limit: 3,
      with_payload: true,
    });

    return searchResults.map((s) => ({
      text: s.payload.text,
      score: s.score,
    }));
  } catch (err) {
    console.error("❌ Qdrant search failed:", err.message);
    return [];
  }
};
