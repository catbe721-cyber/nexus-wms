import 'dotenv/config';
// Note: You might need to add "type": "module" to package.json or use .mjs extension if not already set.
// For simplicity in this environment, I'll use standard fetch if node 18+ or global fetch.

const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ No VITE_GEMINI_API_KEY found in environment variables.");
    process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

console.log(`🔍 Checking models for key: ${apiKey.substring(0, 5)}...`);

try {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    console.log("\n✅ Available Models:");
    const models = data.models || [];

    // Filter for generateContent supported models
    const chatModels = models.filter(m => m.supportedGenerationMethods.includes("generateContent"));

    chatModels.forEach(m => {
        console.log(`- ${m.name.split('/').pop()} (${m.displayName})`);
    });

    console.log("\n(Full list contains " + models.length + " models)");

} catch (error) {
    console.error("❌ Error fetching models:", error.message);
}
