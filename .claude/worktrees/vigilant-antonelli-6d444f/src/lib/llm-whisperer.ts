import { getApiUrl } from '@/lib/api-utils';

export interface LLMWhispererResponse {
    extraction: {
        text: string;
    };
    STATUS: string;
}

export async function processWithLLMWhisperer(base64Image: string, apiKey: string): Promise<string | null> {
    console.log("Starting LLM Whisperer processing...");

    try {
        // Convert Base64 to Blob
        const fetchResponse = await fetch(base64Image);
        const blob = await fetchResponse.blob();

        const formData = new FormData();
        formData.append("file", blob, "roster.jpg");
        formData.append("mode", "layout_preserving"); // Preserves spatial layout
        formData.append("output_format", "text");

        const apiUrl = getApiUrl('api/whisperer');
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "unstract-key": apiKey
            },
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("LLM Whisperer API Error:", response.status, errText);
            throw new Error(`API Error: ${response.status} ${errText}`);
        }

        const initialData = await response.json();
        console.log("LLM Whisperer Initial Response:", initialData);

        if (initialData.extracted_text) {
            return initialData.extracted_text;
        }

        // Async Polling
        if (initialData.whisper_hash) {
            const hash = initialData.whisper_hash;
            let attempts = 0;
            const maxAttempts = 20; // 40 seconds max

            while (attempts < maxAttempts) {
                console.log(`Polling LLM Whisperer (Attempt ${attempts + 1})...`);
                await new Promise(r => setTimeout(r, 2000));

                const statusRes = await fetch(`${apiUrl}?hash=${hash}`, {
                    headers: { "unstract-key": apiKey }
                });

                if (!statusRes.ok) throw new Error("Status check failed");

                const statusData = await statusRes.json();
                console.log("Poll Status:", statusData.status);

                if (statusData.status === 'processed') {
                    // Extract text from the nested structure or directly if flat
                    return statusData.extraction?.text || statusData.text || JSON.stringify(statusData);
                }

                if (statusData.status === 'error') {
                    throw new Error("Job failed on server side");
                }

                attempts++;
            }
            throw new Error("Timeout waiting for LLM Whisperer");
        }

        return JSON.stringify(initialData);

    } catch (error) {
        console.error("LLM Whisperer processing failed:", error);
        return null;
    }
}
