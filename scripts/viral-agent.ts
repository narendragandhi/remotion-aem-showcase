import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SpotlightSceneSchema, AnimationStyle, EffectType } from '../src/aem/schema';

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * MOCK LLM AGENT
 * In a real hackathon, you would replace this with a call to:
 * - OpenAI (gpt-4o)
 * - Gemini (gemini-1.5-pro)
 * - Or a local Llama 3 model
 */
async function generateViralContent(topic: string) {
    console.log(`🤖 Agent is analyzing trending topic: "${topic}"...`);
    
    // Simulate thinking/API latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    // This is the "Intelligence" part of the hack. 
    // The Agent maps a topic to visual parameters.
    const mockResponses: Record<string, any> = {
        "solar eclipse": {
            title: "The Great Eclipse",
            subtitle: "A ONCE IN A LIFETIME EVENT",
            cta: "Where to Watch",
            brandColor: "#050510", // Dark cosmic blue
            imageUrl: "https://images.unsplash.com/photo-1506466010722-395ee2bef877?auto=format&fit=crop&q=80&w=1280",
            animationStyle: "cinematic",
            effectType: "glow",
            effectIntensity: 0.9
        },
        "new iphone": {
            title: "The Future is Here",
            subtitle: "TITANIUM & INTELLIGENCE",
            cta: "Pre-order Now",
            brandColor: "#F5F5F7", // Apple Silver
            imageUrl: "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&q=80&w=1280",
            animationStyle: "minimal",
            effectType: "none",
            effectIntensity: 0.5
        },
        "crypto crash": {
            title: "Market Volatility",
            subtitle: "STAY CALM, HODL ON",
            cta: "View Portfolio",
            brandColor: "#2C0B0E", // Danger red
            imageUrl: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&q=80&w=1280",
            animationStyle: "energetic",
            effectType: "glitch",
            effectIntensity: 0.7
        }
    };

    // Fallback if the topic isn't in our hardcoded "demo" list
    const content = mockResponses[topic.toLowerCase()] || {
        title: `${topic} is Trending`,
        subtitle: "FRESH FROM THE SOCIAL FEED",
        cta: "Read More",
        brandColor: "#6200EE",
        imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=1280",
        animationStyle: "energetic",
        effectType: "glow",
        effectIntensity: 0.6
    };

    return content;
}

async function run() {
    const topic = process.argv[2] || "Solar Eclipse";
    const viralData = await generateViralContent(topic);

    // 1. Prepare the AEM-style JSON structure
    const spotlightJson = {
        id: `agent-generated-${Date.now()}`,
        scenes: [
            {
                ...viralData,
                durationSeconds: 5,
                renditionType: "optimized",
                lottieUrl: "",
                svgOverlayUrl: ""
            }
        ]
    };

    // 2. Path to the mock file Remotion uses
    const mockPath = path.join(__dirname, '../src/mock/aem.json');

    // 3. Write the file (this triggers Remotion's HMR)
    fs.writeFileSync(mockPath, JSON.stringify(spotlightJson, null, 2));

    console.log(`✅ Success! Video content updated for topic: ${topic}`);
    console.log(`👉 Check your Remotion preview to see the changes.`);
    console.log(`💡 Tip: Run 'npm run render:9x16' to export for TikTok.`);
}

run().catch(console.error);
