import Tesseract from 'tesseract.js';

export interface RosterColumn {
    title: string;
    names: string[];
    xStart: number;
    xEnd: number;
}

export interface DigitalRoster {
    date: string;
    columns: RosterColumn[];
    rawText: string;
}

const MONTHS_ES: { [key: string]: number } = {
    'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
    'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
};

export async function scanRosterImage(base64Image: string): Promise<DigitalRoster | null> {
    console.log("Starting New Roster Scanner (v3.0 - Multi-PSM Strategy)...");

    // Helper to run Tesseract with specific PSM
    // PSM 3 = Auto (Default)
    // PSM 6 = Assume a single uniform block of text (Good for tables)
    // PSM 4 = Assume a single column of text of variable sizes
    const runOCR = async (psmMode: string) => {
        console.log(`Running OCR with PSM: ${psmMode}`);
        return await Tesseract.recognize(
            base64Image,
            'spa',
            {
                tessedit_pageseg_mode: psmMode,
            } as any
        );
    };

    try {
        let result = await runOCR('3'); // Try Default first
        let page = result.data;
        let lines = getLinesFromPage(page);

        // If default failed to find structure, try PSM 6 (Single Block)
        // This is often the magic bullet for tables that confuse the layout analyzer
        if (lines.length === 0) {
            console.warn("Default OCR (PSM 3) found no structure. Retrying with PSM 6 (Single Block)...");
            result = await runOCR('6');
            page = result.data;
            lines = getLinesFromPage(page);
        }

        // If PSM 6 failed, try PSM 4 (Single Column)
        if (lines.length === 0) {
            console.warn("PSM 6 failed. Retrying with PSM 4 (Single Column)...");
            result = await runOCR('4');
            page = result.data;
            lines = getLinesFromPage(page);
        }

        // ---------- PROCESSING ----------

        if (lines.length === 0) {
            console.warn("All PSM modes failed to find geometry. Using Raw Text Fallback.");
            return createFallbackRoster(page.text || "No text detected");
        }

        console.log(`OCR Success. Found ${lines.length} lines.`);
        const { text } = page;

        // 1. Detect Global Date
        let splitDate = new Date().toISOString().split('T')[0];
        const currentYear = new Date().getFullYear();
        const headerText = text.substring(0, 500).toUpperCase();
        const longDateMatch = headerText.match(/(\d{1,2})\s+DE\s+([A-Z]+)/);
        if (longDateMatch) {
            const day = parseInt(longDateMatch[1]);
            const monthName = longDateMatch[2];
            if (MONTHS_ES[monthName] !== undefined) {
                const date = new Date(currentYear, MONTHS_ES[monthName], day);
                splitDate = date.toISOString().split('T')[0];
            }
        }

        // 2. Detect Columns
        let detectedColumns: RosterColumn[] = [];
        const getCenterX = (bbox: Tesseract.Bbox) => bbox.x0 + (bbox.x1 - bbox.x0) / 2;

        for (const line of lines) {
            const lineText = line.text.toUpperCase();
            if (lineText.includes("MAÑANA") || lineText.includes("TARDE") || lineText.includes("NOCHE")) {
                const zones: { title: string, x: number, bbox: Tesseract.Bbox }[] = [];
                const words = line.words || [];

                for (const word of words) {
                    const txt = word.text.toUpperCase();
                    if (txt.includes("MAÑANA") || txt.includes("TARDE") || txt.includes("NOCHE")) {
                        zones.push({
                            title: txt,
                            x: getCenterX(word.bbox),
                            bbox: word.bbox
                        });
                    }
                }

                if (zones.length >= 2) {
                    zones.sort((a, b) => a.x - b.x);

                    let previousBoundary = 0;
                    for (let i = 0; i < zones.length; i++) {
                        const zone = zones[i];
                        let nextBoundary = 10000;
                        if (i < zones.length - 1) {
                            nextBoundary = (zone.x + zones[i + 1].x) / 2;
                        }

                        let titleDisplay = zone.title;
                        if (titleDisplay.includes("MAÑANA")) titleDisplay = "MAÑANA (06-14)";
                        if (titleDisplay.includes("TARDE")) titleDisplay = "TARDE (14-22)";
                        if (titleDisplay.includes("NOCHE")) titleDisplay = "NOCHE (22-06)";

                        detectedColumns.push({
                            title: titleDisplay,
                            names: [],
                            xStart: previousBoundary,
                            xEnd: nextBoundary
                        });

                        previousBoundary = nextBoundary;
                    }
                    if (detectedColumns.length > 0) break;
                }
            }
        }

        if (detectedColumns.length === 0) {
            detectedColumns.push({
                title: "TURNO ÚNICO",
                names: [],
                xStart: 0,
                xEnd: 10000
            });
        }

        // 3. Assign Names
        let isSalienteSection = false;
        let salienteHeaders: { [index: number]: string } = {};

        for (const line of lines) {
            const lineText = line.text.toUpperCase().trim();
            if (lineText.length < 5) continue;

            // Detect Start of Saliente Section
            // Relaxed check: just "SALIENTES" is enough.
            if (lineText.includes("SALIENTES")) {
                isSalienteSection = true;
                console.log("Detectada sección: SALIENTES DE SERVICIO");
                continue;
            }

            // Filter junk lines generally
            if (!isSalienteSection) {
                if (lineText.includes("SERVICIOS PARA") || lineText.includes("COMANDANCIA")) continue;
                if (lineText.includes("MAÑANA") && lineText.includes("TARDE")) continue;
            }

            let columnBuffers: { [index: number]: string[] } = {};
            detectedColumns.forEach((_, i) => columnBuffers[i] = []);

            const words = line.words || [];

            for (const word of words) {
                const wordX = getCenterX(word.bbox);
                const colIndex = detectedColumns.findIndex(col => wordX >= col.xStart && wordX < col.xEnd);
                if (colIndex !== -1) {
                    columnBuffers[colIndex].push(word.text);
                }
            }

            detectedColumns.forEach((col, i) => {
                const words = columnBuffers[i];
                if (words.length > 0) {
                    const extractedText = words.join(" ");

                    if (isSalienteSection) {
                        // Improved Heuristic: Check for known Service keywords first
                        const upperText = extractedText.replace(/[^A-ZÑ\s]/g, ' ').trim(); // Clean text

                        const serviceKeywords = [
                            "PENITENCIARIO", "SUBDELEGACION", "PUERTAS",
                            "ACUARTELAMIENTO", "CONTROLES", "PATRULLA", "SEGURIDAD", "PLANA MAYOR"
                        ];

                        const matchedKeyword = serviceKeywords.find(k => upperText.includes(k));

                        const isRank = extractedText.match(/^(G\.C\.|GC\.|SGT|CABO|TTE|CAP|CMDT)/i);
                        const isNameLike = extractedText.includes(",");

                        if (matchedKeyword) {
                            // High confidence this is a header
                            salienteHeaders[i] = matchedKeyword;
                            if (upperText.length > 3) {
                                salienteHeaders[i] = upperText;
                            }
                            console.log(`Detected Saliente Header (Keyword "${matchedKeyword}") for Col ${i}: ${salienteHeaders[i]}`);

                        } else if (!isRank && !isNameLike && extractedText.length > 3) {
                            // Fallback for unknown services
                            let header = extractedText.replace(/[^A-ZÑ\s]/gi, '').trim();
                            if (header.length > 3) {
                                salienteHeaders[i] = header;
                            }
                        } else if ((isRank || isNameLike) && extractedText.length > 3 && isNaN(Number(extractedText))) {
                            // Person detection
                            const serviceHeader = salienteHeaders[i] || "SERVICIO";
                            const labeledName = `(SALIENTE ${serviceHeader}) ${extractedText}`;
                            col.names.push(labeledName);
                        }
                    } else {
                        // Standard Section
                        // Verify it's not a service header leaking in
                        const upperText = extractedText.toUpperCase();
                        const serviceKeywords = [
                            "PENITENCIARIO", "SUBDELEGACION", "PUERTAS",
                            "ACUARTELAMIENTO", "CONTROLES", "PATRULLA"
                        ];
                        const isServiceHeader = serviceKeywords.some(k => upperText.includes(k));

                        if (!isServiceHeader && extractedText.length > 3 && isNaN(Number(extractedText))) {
                            col.names.push(extractedText);
                        }
                    }
                }
            });
        }

        return {
            date: splitDate,
            columns: detectedColumns,
            rawText: "Scanner v3.0 (Success)\n" + text.substring(0, 200) + "..."
        };

    } catch (error) {
        console.error("Scanner v3 Error:", error);
        return createFallbackRoster("Error Fatal (v3): " + error);
    }
}

// ---------------- HELPERS ----------------

function getLinesFromPage(page: any): any[] {
    // 1. Try standard lines
    if (page.lines && page.lines.length > 0) return page.lines;

    // 2. Try recursive word reconstruction
    const allWords = getAllWordsRecursively(page);
    if (allWords.length > 0) {
        return reconstructLinesFromWords(allWords);
    }

    return [];
}

function getAllWordsRecursively(data: any): any[] {
    let collectedWords: any[] = [];
    if (Array.isArray(data.words)) collectedWords.push(...data.words);
    if (Array.isArray(data.blocks)) {
        data.blocks.forEach((block: any) => {
            if (Array.isArray(block.words)) collectedWords.push(...block.words);
            if (Array.isArray(block.paragraphs)) {
                block.paragraphs.forEach((p: any) => {
                    if (Array.isArray(p.words)) collectedWords.push(...p.words);
                    if (Array.isArray(p.lines)) {
                        p.lines.forEach((l: any) => {
                            if (Array.isArray(l.words)) collectedWords.push(...l.words);
                        });
                    }
                });
            }
        });
    }
    // Deep search in TSV/HOCR is handled by Tesseract internals usually, 
    // but if we need manual TSV/HOCR parsing, we can add it here.
    return Array.from(new Set(collectedWords));
}

function reconstructLinesFromWords(words: any[]): any[] {
    words.sort((a: any, b: any) => {
        const yDiff = a.bbox.y0 - b.bbox.y0;
        if (Math.abs(yDiff) < 10) return a.bbox.x0 - b.bbox.x0;
        return yDiff;
    });

    const reconstructedLines: any[] = [];
    let currentLine: any = { words: [], bbox: null, text: "" };

    words.forEach((word: any) => {
        if (currentLine.words.length === 0) {
            currentLine.words.push(word);
            currentLine.bbox = { ...word.bbox };
            return;
        }

        const lastWord = currentLine.words[currentLine.words.length - 1];
        const yDiff = Math.abs(getCenterY(word.bbox) - getCenterY(lastWord.bbox));

        if (yDiff < 15) {
            currentLine.words.push(word);
            currentLine.bbox.x1 = Math.max(currentLine.bbox.x1, word.bbox.x1);
            currentLine.bbox.y1 = Math.max(currentLine.bbox.y1, word.bbox.y1);
        } else {
            currentLine.text = currentLine.words.map((w: any) => w.text).join(' ');
            reconstructedLines.push(currentLine);
            currentLine = { words: [word], bbox: { ...word.bbox }, text: "" };
        }
    });

    if (currentLine.words.length > 0) {
        currentLine.text = currentLine.words.map((w: any) => w.text).join(' ');
        reconstructedLines.push(currentLine);
    }
    return reconstructedLines;
}

function createFallbackRoster(text: string): DigitalRoster {
    return {
        date: new Date().toISOString().split('T')[0],
        columns: [{
            title: "TEXTO DETECTADO (SIN FORMATO)",
            names: text.split('\n').filter(l => l.trim().length > 3),
            xStart: 0,
            xEnd: 10000
        }],
        rawText: text
    };
}

// --- Smart Local Search ---

export async function findUserShiftLocal(base64Image: string, targetName: string): Promise<any | null> {
    console.log(`[Local Scanner] Starting smart analysis for: ${targetName}`);

    // 1. Run Layout Analysis (Tesseract)
    const roster = await scanRosterImage(base64Image);
    if (!roster) return null;

    const targetUpper = targetName.toUpperCase().trim();
    let result: {
        found: boolean;
        date: string;
        targetName: string;
        shift: string;
        service: string;
        startTime: string;
        endTime: string;
        colleagues: string[];
        rawContext: string;
    } = {
        found: false,
        date: roster.date,
        targetName: targetName,
        shift: "",
        service: "",
        startTime: "",
        endTime: "",
        colleagues: [],
        rawContext: "Scan Local (Inteligente)"
    };

    // 2. Try Column Match (SKIPPED - Legacy Logic was inaccurate for multi-service pages)
    // We now rely exclusively on the Proximity Parser (Step 3) which handles vertical context and service names correctly.
    /*
    for (const col of roster.columns) {
         // ... code removed to force Proximity Parse ...
    }
    */

    // 3. Regex Fallback (If layout failed but text exists)
    // Look for lines that contain the name and try to infer context
    // 3. Regex Fallback (Advanced State Machine)
    // If layout failed but text exists, parse the whole document relative to the target
    // 3. Regex Fallback (Robust Proximity Parser - V3)
    // Solves the "Jumbled Output" problem by finding context spatially near the target line.
    if (roster.rawText) {
        const textLines = roster.rawText.split('\n');
        const targetUpperTrim = targetUpper.replace(/\s+/g, ' ');

        // Find Target Line Index
        // Improved match: check includes but ensure it's not just a substring of another word if possible, or just trust includes for now.
        const targetLineIndex = textLines.findIndex(l => l.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(targetUpperTrim));

        if (targetLineIndex !== -1) {
            result.found = true;
            result.targetName = textLines[targetLineIndex].trim();
            result.rawContext = "Scan Local (Proximidad)";

            // --- CONTEXT SEARCH (Look Upwards for Headers) ---
            const serviceKeywords = ["SERVICIO", "CENTRO PENITENCIARIO", "SUBDELEGACION", "ACUARTELAMIENTO", "CONDUCCION", "MONITORES", "CURSOS", "SALIENTES", "PUERTAS", "PATRULLA", "SEGURIDAD", "PLANA MAYOR", "NUCLI", "NUCLEO", "EVENTOS", "ORDEN PUBLICO"];

            let foundService = "SERVICIO GENERAL";
            let foundSchedule = { shift: "MAÑANA", start: "06:00", end: "14:00" };

            // Search UPWARDS from target line to find the NEAREST header
            let serviceDetected = false;
            let scheduleDetected = false;

            for (let i = targetLineIndex - 1; i >= Math.max(0, targetLineIndex - 50); i--) {
                const line = textLines[i].toUpperCase().trim();
                if (line.length < 3) continue;

                // 1. Detect Schedule (If we haven't found a closer one yet)
                // Patterns: "DE 06 A 14", "14/22", "22 A 06"
                if (!scheduleDetected) {
                    const timeMatch = line.match(/(?:DE)?\s*(\d{1,2})[\.:]?\d{0,2}\s*(?:A|:|H|-)\s*(\d{1,2})[\.:]?\d{0,2}/);
                    if (timeMatch) {
                        const startH = parseInt(timeMatch[1]);
                        const endH = parseInt(timeMatch[2]);
                        if (startH >= 0 && startH <= 24 && endH >= 0 && endH <= 24) {
                            let shift = "MAÑANA";
                            if (startH >= 12 && startH < 21) shift = "TARDE";
                            if (startH >= 21 || startH < 7) shift = "NOCHE";

                            foundSchedule = {
                                shift: shift,
                                start: `${startH.toString().padStart(2, '0')}:00`,
                                end: `${endH.toString().padStart(2, '0')}:00`
                            };
                            scheduleDetected = true;
                        }
                    }
                }

                // 2. Detect Service (First valid one found going UP is the parent)
                if (!serviceDetected && serviceKeywords.some(k => line.includes(k)) && !line.includes("LLAMADAS")) {
                    foundService = line.replace(/[^A-ZÑ\s]/g, '').trim(); // Clean junk chars
                    serviceDetected = true;
                }

                if (serviceDetected && scheduleDetected) break; // Found both closest headers
            }

            // Apply Context
            if (foundService.includes("SALIENTE")) foundSchedule.shift = "SALIENTE";

            result.service = foundService;
            result.shift = foundSchedule.shift;
            result.startTime = foundSchedule.start;
            result.endTime = foundSchedule.end;


            // --- COLLEAGUES SEARCH (Look Around Target) ---
            // Scan +/- 20 lines. A colleague is someone who shares the SAME Context (Service).
            // But their TIME might be different (e.g. 07-14 vs 06-14).

            const potentialColleagues: string[] = [];
            const range = 25;

            for (let i = Math.max(0, targetLineIndex - range); i <= Math.min(textLines.length - 1, targetLineIndex + range); i++) {
                if (i === targetLineIndex) continue; // Skip self

                const line = textLines[i].toUpperCase().trim();
                // Heuristic for Name: "G.C." or "D./Dª." or Contains Comma, and No Numbers (to avoid headers)
                const isName = (line.includes("G.C.") || line.includes("GUARDIA") || line.includes(",") || line.startsWith("D.") || line.startsWith("Dª")) && line.length > 8 && !line.includes("SERVICIO") && !/\d{2}/.test(line);

                if (isName) {
                    // Check THIS person's context to see if they are in the same block
                    // We look UP from this person to see if we hit the SAME Service header before hitting a DIFFERENT Service header
                    let personService = "UNKNOWN";
                    let personSchedule = { ...foundSchedule }; // Default to main schedule

                    // Quick scan up for this person
                    for (let j = i - 1; j >= Math.max(0, i - 40); j--) {
                        const l = textLines[j].toUpperCase();
                        if (serviceKeywords.some(k => l.includes(k)) && !l.includes("LLAMADAS")) {
                            personService = l.replace(/[^A-ZÑ\s]/g, '').trim();
                            break; // First service header up is theirs
                        }
                    }

                    // If matches target service, they are a colleague
                    if (personService === foundService || (personService === "UNKNOWN" && Math.abs(i - targetLineIndex) < 10)) {
                        // Refine Schedule for this person (they might be under a different column header in the same service)
                        for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
                            const l = textLines[j].toUpperCase();
                            // Stop if we hit service
                            if (serviceKeywords.some(k => l.includes(k))) break;

                            const timeMatch = l.match(/(?:DE)?\s*(\d{1,2})[\.:]?\d{0,2}\s*(?:A|:|H|-)\s*(\d{1,2})[\.:]?\d{0,2}/);
                            if (timeMatch) {
                                const s = parseInt(timeMatch[1]);
                                const e = parseInt(timeMatch[2]);
                                personSchedule.start = `${s.toString().padStart(2, '0')}:00`;
                                personSchedule.end = `${e.toString().padStart(2, '0')}:00`;
                                break;
                            }
                        }

                        const cleanName = textLines[i].replace(/G\.?C\.?\s*/i, '').replace(/D\.?\s*/i, '').replace(/Dª\.?\s*/i, '').trim();
                        potentialColleagues.push(`${cleanName}|${personSchedule.start}|${personSchedule.end}`);
                    }
                }
            }
            result.colleagues = potentialColleagues;

            return result;
        }
    }

    if (result.found) return result;
    return null;
}

function getCenterY(bbox: Tesseract.Bbox) {
    if (!bbox) return 0;
    return bbox.y0 + (bbox.y1 - bbox.y0) / 2;
}
