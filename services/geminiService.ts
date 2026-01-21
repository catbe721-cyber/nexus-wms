import { GoogleGenAI } from "@google/genai";
import { InventoryItem } from "../types";

const getAIClient = () => {
  // Safe access to process.env to prevent "process is not defined" crashes in some browser environments
  const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;

  if (!apiKey) {
    throw new Error("API Key not found. Please ensure process.env.API_KEY is configured.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeInventory = async (query: string, inventory: InventoryItem[]) => {
  try {
    const ai = getAIClient();
    
    // Prepare a simplified version of inventory to save tokens
    const simplifiedInventory = inventory.map(item => ({
      name: item.productName,
      code: item.productCode,
      qty: item.quantity,
      unit: item.unit,
      cat: item.category,
      locs: item.locations.map(l => `${l.rack}-${l.bay}-${l.level}`).join(', ')
    }));

    const prompt = `
      You are an intelligent Warehouse Assistant. 
      Here is the current inventory data (JSON format):
      ${JSON.stringify(simplifiedInventory).slice(0, 20000)} 
      
      User Query: "${query}"
      
      Please answer the user's question based on the inventory data provided. 
      If asking for a summary, provide a concise table or bullet points.
      If asking for location, specify the Rack, Bay, and Level clearly.
      Keep the tone professional and helpful.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error analyzing the inventory. Please check your API key or try again later.";
  }
};

export const parsePickList = async (base64Image: string) => {
  try {
    const ai = getAIClient();
    
    // Extract base64 data if it has the prefix
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const prompt = `
      You are a data extraction OCR engine. 
      Analyze the provided image of a warehouse pick list table.
      Extract all rows where the Quantity (Qty) is explicitly greater than 0.
      
      Return the data strictly as a JSON array of objects. 
      Do not include markdown formatting (like \`\`\`json). 
      Do not include any introductory or concluding text.
      
      Target JSON Structure:
      [
        { "code": "product_code_string_or_empty", "name": "item_name_string", "qty": number }
      ]
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: prompt }
        ]
      }
    });

    const text = response.text || '';
    
    // Attempt to extract JSON array using Regex to ignore conversational filler
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
    } else {
        // Fallback: try parsing the whole text if regex fails (unlikely if conversational)
        // If the model returned "I'm sorry...", JSON.parse will throw, which is caught below.
        return JSON.parse(text);
    }

  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw new Error("Failed to process pick list. Ensure the image is a clear warehouse document.");
  }
};