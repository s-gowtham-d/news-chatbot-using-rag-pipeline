/**
 * Gemini Service
 * Handles interactions with Google Gemini API
 */
import dotenv from 'dotenv';

dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const getStreamingResponseFromGemini = async (query, context, conversationHistory = []) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 800,
      }
    });

    let conversationContext = "";
    if (conversationHistory.length > 0) {
      conversationContext = "\n\nPrevious conversation:\n";
      conversationHistory.slice(-6).forEach(msg => {  
        conversationContext += `User: ${msg.user}\nAssistant: ${msg.bot}\n\n`;
      });
    }

    const prompt = `You are a helpful news assistant chatbot. Answer questions based on the provided news context and previous conversation.

CRITICAL RULES:
1. ALWAYS provide a response - NEVER return empty text
2. If the context doesn't fully answer the question, provide what information you do have
3. Write in a natural, conversational tone (like you're chatting with a friend)
4. Keep responses concise but informative (2-4 sentences)
5. DO NOT use bullet points, asterisks, or markdown formatting
6. Reference previous conversation when relevant
7. If you're unsure, say so and offer what you do know

News Context:
${context || 'No relevant news articles found.'}
${conversationContext}

Current User Question: ${query}

Response (in plain conversational text):`;

    const result = await model.generateContentStream(prompt);
    return result.stream;
  } catch (err) {
    console.error("❌ Gemini streaming error:", err.message);
    throw err;
  }
};

export const getResponseFromGemini = async (query, context, conversationHistory = []) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 800,
      }
    });

    let conversationContext = "";
    if (conversationHistory.length > 0) {
      conversationContext = "\n\nPrevious conversation:\n";
      conversationHistory.slice(-6).forEach(msg => {
        conversationContext += `User: ${msg.user}\nAssistant: ${msg.bot}\n\n`;
      });
    }

    const prompt = `You are a helpful news assistant chatbot. Answer questions based on the provided news context and previous conversation.

IMPORTANT FORMATTING RULES:
- Write in clear, conversational paragraphs
- DO NOT use bullet points or lists
- DO NOT use asterisks or special markdown
- Keep responses concise (2-3 sentences unless asked for details)
- Reference previous conversation when relevant
- If asked about something not in the context, politely say you don't have that information about the news
- Always provide a response
- If unsure, provide what information you do have
- Maintain a friendly and engaging tone
- If user want more details, provide them in follow-up responses
- Stay relevant to the news context provided and based on previous conversation

News Context:
${context || 'No relevant news articles found.'}
Previous Conversation:
${conversationContext}

Current User Question: ${query}

Response (in plain conversational text):`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error("❌ Gemini API error:", err.message);
    return "I encountered an error while generating a response. Please try again.";
  }
};