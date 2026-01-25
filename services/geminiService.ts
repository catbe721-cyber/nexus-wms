import { GoogleGenAI } from "@google/genai";
import { InventoryItem, Product } from "../types";

const getAIClient = () => {
  // Use Vite environment variable
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new Error("API Key not found or invalid. Please ensure VITE_GEMINI_API_KEY is set in .env");
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
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error analyzing the inventory. Please check your API key or try again later.";
  }
};

export const parsePickList = async (base64Image: string, products: Product[]) => {
  try {
    const ai = getAIClient();

    // Extract base64 data if it has the prefix
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const productList = products.map(p => `Code: ${p.productCode}, Name: ${p.name}`).join('\n');

    const prompt = `
      You are a data extraction OCR engine and warehouse product matcher. 
      Analyze the provided image of a warehouse pick list table.
      
      CRITICAL: You MUST match the items found in the image to the following Master Product List:
      ${productList}

      Extract all rows where the Quantity (Qty) is explicitly greater than 0.
      For each item found:
      1. Find the best matching Product Code from the Master Product List above.
      2. If no clear match is found, provide the name as written in the image.

      Return the data strictly as a JSON array of objects. 
      Do not include markdown formatting (like \`\`\`json). 
      
      Target JSON Structure:
      [
        { "code": "matched_product_code", "name": "item_name_from_image", "qty": number }
      ]
    `;

    console.log("Gemini Prompt:", prompt);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64
              }
            },
            { text: prompt }
          ]
        }
      ]
    });

    const text = response.text || '';
    console.log("Gemini Raw Response:", text);

    // Attempt to extract JSON array using Regex to ignore conversational filler
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      // Fallback: try parsing the whole text if regex fails (unlikely if conversational)
      // If the model returned "I'm sorry...", JSON.parse will throw, which is caught below.
      return JSON.parse(text);
    }

  } catch (error: any) {
    console.error("Gemini Vision Detailed Error:", error);
    if (error.response) console.error("Error Response:", error.response);
    throw new Error(`Failed to process pick list: ${error.message || 'Check console for details'}`);
  }
};