import Groq from "groq-sdk";
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;

if (!apiKey) {
    console.error("No API Key found in .env.local");
    process.exit(1);
}

const groq = new Groq({ apiKey });

import fs from 'fs';

async function main() {
    try {
        const models = await groq.models.list();
        console.log("Available Groq Models:");
        const modelIds = models.data.map(m => m.id).join('\n');
        console.log(modelIds);
        fs.writeFileSync('available_groq_models.txt', modelIds);
        console.log("Saved to available_groq_models.txt");
    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

main();
