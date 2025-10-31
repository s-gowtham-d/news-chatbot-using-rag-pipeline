// /**
//  * Gemini Service
//  * Handles interactions with Google Gemini API
//  */
import dotenv from 'dotenv';

dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";
import { analyzeQueryIntent } from "./vectorService.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Build context-aware prompt based on intent
 */
const buildPrompt = (query, context, conversationHistory, intent, docs) => {
  // Build conversation context
  let conversationContext = "";
  if (conversationHistory.length > 0) {
    conversationContext = "\n\nPrevious conversation:\n";
    conversationHistory.slice(-3).forEach(msg => {
      conversationContext += `User: ${msg.user}\nAssistant: ${msg.bot}\n\n`;
    });
  }

  // Base instructions
  let instructions = `You are a helpful news assistant. Answer naturally and conversationally.

CRITICAL RULES:
- ALWAYS provide a response (never return empty text)
- Write in plain paragraphs (NO bullet points, asterisks, or markdown)
- Be conversational and friendly
- Keep responses concise but informative
- Give Article Links when relevant and possible
- If the context doesn't fully answer the question, provide what information you do have
- If you're unsure, say so and offer what you do know
- Reference previous conversation when relevant`;


  // Customize based on intent
  if (intent === 'list' || intent === 'summary') {
    instructions += `\n- Provide a brief summary of the main news stories (2-3 sentences per story)
- Keep it concise but informative`;
  } else if (intent === 'details') {
    instructions += `\n- Provide more detailed information based on the context
- Elaborate on the topic from previous conversation`;
  } else if (intent === 'links') {
    instructions += `\n- Mention article titles and include links if available
- Format naturally: "You can read more about [topic] at [link]"`;
  }

  // Add available links if present
  let linksInfo = "";
  if (docs && docs.length > 0) {
    const docsWithLinks = docs.filter(d => d.link);
    if (docsWithLinks.length > 0) {
      linksInfo = "\n\nAvailable article links:\n";
      docsWithLinks.forEach(d => {
        linksInfo += `- ${d.title}: ${d.link}\n`;
      });
    }
  }

  return `${instructions}

News Articles:
${context}
${linksInfo}
${conversationContext}

User's Question: ${query}

Your Response:`;
};

export const getStreamingResponseFromGemini = async (query, context, conversationHistory = [], docs = []) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    });

    // Analyze query intent
    const intent = analyzeQueryIntent(query);
    console.log(`🎯 Detected intent: ${intent}`);

    // Build context-aware prompt
    const prompt = buildPrompt(query, context, conversationHistory, intent, docs);

    const result = await model.generateContentStream(prompt);
    return result.stream;
    
  } catch (err) {
    console.error("❌ Gemini streaming error:", err.message);
    
    // Return fallback stream
    return {
      async *[Symbol.asyncIterator]() {
        yield {
          text: () => "I apologize, but I'm having trouble generating a response right now. Please try again."
        };
      }
    };
  }
};

export const getResponseFromGemini = async (query, context, conversationHistory = [], docs = []) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });

    const intent = analyzeQueryIntent(query);
    console.log(`🎯 Detected intent: ${intent}`);

    const prompt = buildPrompt(query, context, conversationHistory, intent, docs);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    if (!text || text.trim().length === 0) {
      return "I found relevant articles but had trouble formulating a response. Could you rephrase your question?";
    }
    
    return text;
    
  } catch (err) {
    console.error("❌ Gemini API error:", err.message);
    return "I'm having trouble generating a response right now. Please try again.";
  }
};