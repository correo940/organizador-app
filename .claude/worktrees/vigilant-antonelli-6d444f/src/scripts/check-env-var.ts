import dotenv from 'dotenv';
import path from 'path';

// Try loading from .env.local explicitly
const envPath = path.resolve(process.cwd(), '.env.local');
console.log("Loading env from:", envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("Error loading .env.local:", result.error);
}

console.log("--- ENV CHECK START ---");
console.log("NEXT_PUBLIC_GROQ_API_KEY:", process.env.NEXT_PUBLIC_GROQ_API_KEY ? "FOUND (Length: " + process.env.NEXT_PUBLIC_GROQ_API_KEY.length + ")" : "MISSING");
console.log("GROQ_API_KEY:", process.env.GROQ_API_KEY ? "FOUND" : "MISSING");
console.log("--- ENV CHECK END ---");
