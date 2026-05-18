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

export async function extractRosterDataLocal(base64Image: string): Promise<DigitalRoster | null> {
    console.log("Starting Geometric Roster Extraction (Self-Contained)...");

    try {
        // INLINED TESSERACT CALL to avoid module caching issues
        // We use the default 'spa' language.
        const result = await Tesseract.recognize(
            base64Image,
            'spa',
            // { logger: m => console.log(m) } // Silent logger for performance
        );

        const page = result.data;
        // Verify structure
        if (!page || !page.text) {
            throw new Error("OCR returned empty result");
        }

        // Helper to safely get lines from various Tesseract structures
        const getLinesSafely = (data: any): any[] => {
            if (Array.isArray(data.lines)) return data.lines;
            if (Array.isArray(data.blocks)) {
                const allLines: any[] = [];
                data.blocks.forEach((block: any) => {
                    if (Array.isArray(block.paragraphs)) {
                        block.paragraphs.forEach((p: any) => {
                            if (Array.isArray(p.lines)) {
                                allLines.push(...p.lines);
                            }
                        });
                    }
                });
                return allLines;
            }
            return [];
        };

        const lines = getLinesSafely(page);

        if (lines.length === 0) {
            const availableKeys = Object.keys(page).join(', ');
            console.error("No lines found. Keys available:", availableKeys);
            throw new Error(`Estructura OCR inesperada. Claves: ${availableKeys}`);
        }

        const { text } = page;
        const currentYear = new Date().getFullYear();
        const headerText = text.substring(0, 500).toUpperCase();
        let splitDate = new Date().toISOString().split('T')[0];
        const longDateMatch = headerText.match(/(\d{1,2})\s+DE\s+([A-Z]+)/);
        if (longDateMatch) {
            const day = parseInt(longDateMatch[1]);
            const monthName = longDateMatch[2];
            if (MONTHS_ES[monthName] !== undefined) {
                const date = new Date(currentYear, MONTHS_ES[monthName], day);
                splitDate = date.toISOString().split('T')[0];
            }
        }

        // 2. Detect Columns (Geometry)
        let detectedColumns: RosterColumn[] = [];
        const getCenterX = (bbox: Tesseract.Bbox) => bbox.x0 + (bbox.x1 - bbox.x0) / 2;

        for (const line of lines) {
            const lineText = line.text.toUpperCase();
            if (lineText.includes("MAÑANA") || lineText.includes("TARDE") || lineText.includes("NOCHE")) {
                const zones: { title: string, x: number, bbox: Tesseract.Bbox }[] = [];

                for (const word of line.words) {
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

                        // If there is a next zone, the boundary is the midpoint
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
                title: "TURNO ÚNICO / LISTA GENERAL",
                names: [],
                xStart: 0,
                xEnd: 10000
            });
        }

        // 3. Assign Names to Columns
        for (const line of lines) {
            const lineText = line.text.toUpperCase();

            // Skip short lines/junk
            if (lineText.length < 5) continue;
            // Skip header lines
            if (lineText.includes("SERVICIOS PARA") || lineText.includes("COMANDANCIA")) continue;
            if (lineText.includes("MAÑANA") && lineText.includes("TARDE")) continue;

            let columnBuffers: { [index: number]: string[] } = {};
            detectedColumns.forEach((_, i) => columnBuffers[i] = []);

            for (const word of line.words) {
                const wordX = getCenterX(word.bbox);
                const colIndex = detectedColumns.findIndex(col => wordX >= col.xStart && wordX < col.xEnd);
                if (colIndex !== -1) {
                    columnBuffers[colIndex].push(word.text);
                }
            }

            detectedColumns.forEach((col, i) => {
                const words = columnBuffers[i];
                if (words.length > 0) {
                    // Reconstruct name from words
                    const extractedName = words.join(" ");
                    // Simple filter to avoid noise
                    if (extractedName.length > 3 && !extractedName.includes("SERVICIO")) {
                        col.names.push(extractedName);
                    }
                }
            });
        }

        return {
            date: splitDate,
            columns: detectedColumns,
            rawText: text
        };

    } catch (error) {
        console.error("Local self-contained extraction failed:", error);
        return {
            date: new Date().toISOString(),
            columns: [],
            rawText: "Error Fatal (Self-Contained): " + error
        };
    }
}
