import { Client } from "@gradio/client";

async function testGradio() {
    console.log("Connecting to Gradio...");
    const app = await Client.connect("https://a541ff051f4ee9080f.gradio.live");
    
    console.log("Connected! Testing /load_names with 'Spanish'");
    const resNames = await app.predict("/load_names", ["Spanish"]);
    console.log("load_names return:", JSON.stringify(resNames, null, 2));

    let speaker = "Alejandro_-_Mexican_male";
    if (resNames.data?.[0]?.choices?.length > 0) {
        speaker = resNames.data[0].choices[0];
    } else if (Array.isArray(resNames.data?.[0]) && resNames.data[0].length > 0) {
        speaker = resNames.data[0][0];
    }
    
    console.log(`\nTesting /run_tts0 with speaker: ${speaker}`);
    const resAudio = await app.predict("/run_tts0", [
        "Spanish",
        "es",
        "Hola probando la API de gradio cliente.",
        speaker,
        0.75,
        1,
        5,
        50,
        0.85,
        true,
        false
    ]);
    
    console.log("Audio return:", JSON.stringify(resAudio.data, null, 2));
}

testGradio().catch(console.error);
