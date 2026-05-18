
import { getApiUrl } from '@/lib/api-utils';

export interface UserShiftResult {
    found: boolean;
    date: string;
    targetName: string;
    shift: string;
    service?: string;
    startTime: string;
    endTime: string;
    colleagues: string[];
    rawContext: string;
}

const OCR_SPACE_KEY = "K84515341388957";

export async function findUserShiftOCRSpace(base64Image: string, targetName: string, shiftTypes: any[] = []): Promise<UserShiftResult | null> {
    console.log(`[OCR.space] Starting Hierarchical Analysis for: ${targetName}`);

    try {
        // ... (fetch logic same) ...
        const formData = new FormData();
        formData.append("base64Image", base64Image);
        formData.append("apikey", OCR_SPACE_KEY);
        formData.append("language", "spa");
        formData.append("isTable", "true");
        formData.append("isOverlayRequired", "true");
        formData.append("scale", "true");
        formData.append("OCREngine", "2");

        const response = await fetch(getApiUrl('api/ocr-space'), {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (data.IsErroredOnProcessing) {
            throw new Error(data.ErrorMessage?.[0] || "Unknown OCR Error");
        }

        const parsedResult = data.ParsedResults?.[0];
        if (!parsedResult) throw new Error("No results from OCR.space");

        const fullText = parsedResult.ParsedText || "Texto no detectado";
        const overlay = parsedResult.TextOverlay;

        if (!overlay || !overlay.Lines) {
            console.warn("No Overlay found, fallback to text search");
            return null;
        }

        // --- HIERARCHICAL ANALYSIS ---

        // 1. Structure all lines for easier access
        const lines = overlay.Lines.map((l: any) => {
            const first = l.Words[0];
            const last = l.Words[l.Words.length - 1];
            let text = l.LineText || l.Words.map((w: any) => w.WordText).join(" ");

            // Fix common OCR error: "DI" -> "Dª" (Doña)
            text = text.replace(/\bDI\s/g, "Dª ").replace(/^DI\s/g, "Dª ")
                .replace(/\bD[I|l|1]\s/g, "Dª ")
                .replace(/^D[I|l|1]\s/g, "Dª ")
                .replace(/\bD\s+[I|l|1]\s/g, "Dª ");

            return {
                text: text,
                cleanText: text.toUpperCase().trim(),
                top: l.MinTop,
                bottom: l.MinTop + l.MaxHeight,
                left: first.Left,
                right: last.Left + last.Width,
                center: (first.Left + last.Left + last.Width) / 2,
                height: l.MaxHeight
            };
        });

        // 2. Identify Metadata (Date) ... (same)
        let foundDate = new Date().toISOString().split('T')[0];
        const dateLine = lines.find((l: any) => l.top < 500 && /(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})/i.test(l.cleanText));
        if (dateLine) {
            const match = dateLine.cleanText.match(/(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})/i);
            if (match) {
                const months: any = { "ENERO": "01", "FEBRERO": "02", "MARZO": "03", "ABRIL": "04", "MAYO": "05", "JUNIO": "06", "JULIO": "07", "AGOSTO": "08", "SEPTIEMBRE": "09", "OCTUBRE": "10", "NOVIEMBRE": "11", "DICIEMBRE": "12" };
                const m = months[match[2]];
                if (m) foundDate = `${match[3]}-${m}-${match[1].padStart(2, '0')}`;
            }
        }

        // 3. Identify Section Headers
        const sectionHeaders = lines.filter((l: any) => {
            const t = l.cleanText;
            return (t.includes("SERVICIO") || t.includes("CONDUCCIÓN") || t.includes("PLAN PATIO") || t.includes("SALIENTES")) && !t.includes("HORAS");
        }).sort((a: any, b: any) => a.top - b.top);

        // 4. Identify Time/Column Headers
        // Logic: 
        // A) Look for "DE X A Y" pattern
        // B) Look for EXACT or STARTS_WITH matches with Configured Shift Codes (e.g. "M", "T", "N", "NOCHE")
        // C) Look for common keywords "MAÑANA", "TARDE", "NOCHE" explicitly
        const timeHeaders = lines.filter((l: any) => {
            if (l.cleanText.includes("SERVICIO")) return false; // Not a time header

            const txt = l.cleanText;

            // A) Pattern match
            if (/DE\s*\d{1,2}\s*A\s*\d{1,2}/.test(txt)) return true;

            // B) Code/Label match (Flexible)
            if (shiftTypes && shiftTypes.length > 0) {
                // Check if line starts with a code or label (followed by space or end of line)
                // e.g. "M" or "M 07-15" or "NOCHE (22-06)"
                const match = shiftTypes.find(s =>
                    txt === s.code ||
                    txt === s.label ||
                    txt.startsWith(s.code + " ") ||
                    txt.startsWith(s.label + " ")
                );
                if (match) return true;
            }

            // C) Explicit Keywords
            if (["MAÑANA", "TARDE", "NOCHE"].includes(txt) ||
                txt.startsWith("MAÑANA ") ||
                txt.startsWith("TARDE ") ||
                txt.startsWith("NOCHE ")) {
                return true;
            }

            return false;
        }).map((l: any) => {
            const txt = l.cleanText;

            // Check for Configured Match First
            if (shiftTypes && shiftTypes.length > 0) {
                const knownShift = shiftTypes.find(s =>
                    txt === s.code ||
                    txt === s.label ||
                    txt.startsWith(s.code + " ") ||
                    txt.startsWith(s.label + " ")
                );

                if (knownShift) {
                    return {
                        ...l,
                        shiftType: knownShift.label || knownShift.code, // Prefer Label
                        startTime: knownShift.start_time,
                        endTime: knownShift.end_time
                    };
                }
            }

            // Check for Keywords if no custom config matched
            if (txt.startsWith("MAÑANA")) return { ...l, shiftType: "MAÑANA", startTime: "07:00", endTime: "15:00" };
            if (txt.startsWith("TARDE")) return { ...l, shiftType: "TARDE", startTime: "15:00", endTime: "23:00" };
            if (txt.startsWith("NOCHE")) return { ...l, shiftType: "NOCHE", startTime: "23:00", endTime: "07:00" };

            // Fallback to Regex Parsing
            const match = txt.match(/(?:(MAÑANA|TARDE|NOCHE).*?)?DE\s*(\d{1,2})\s*A\s*(\d{1,2})/);
            return {
                ...l,
                shiftType: match && match[1] ? match[1] : "HORARIO DE SERVICIO",
                startTime: match ? match[2].padStart(2, '0') + ":00" : "--:--",
                endTime: match ? match[3].padStart(2, '0') + ":00" : "--:--"
            };
        });

        // 5. Find Target User - IMPROVED MATCHING
        // Helper: Normalize text for comparison (remove accents, special chars)
        const normalizeText = (text: string): string => {
            return text
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[ÑÑ]/g, 'N')
                .replace(/[^A-Z\s]/g, ' ') // Keep only letters and spaces
                .replace(/\s+/g, ' ')
                .trim();
        };

        // Helper: Calculate similarity (simple Levenshtein-like for short strings)
        const similarity = (a: string, b: string): number => {
            if (a === b) return 1;
            if (a.includes(b) || b.includes(a)) return 0.9;

            // Check each word separately for partial matches
            const aWords = a.split(' ').filter(w => w.length > 2);
            const bWords = b.split(' ').filter(w => w.length > 2);

            let matches = 0;
            for (const aw of aWords) {
                for (const bw of bWords) {
                    if (aw.includes(bw) || bw.includes(aw)) {
                        matches++;
                        break;
                    }
                }
            }
            return matches / Math.max(aWords.length, 1);
        };

        const normalizedTarget = normalizeText(targetName);
        const targetWords = normalizedTarget.split(' ').filter(w => w.length > 2);

        console.log(`[OCR] Searching for: "${normalizedTarget}" (words: ${targetWords.join(', ')})`);

        // Try exact match first
        let userLine = lines.find((l: any) =>
            normalizeText(l.text).includes(normalizedTarget)
        );

        // If not found, try partial word matching
        if (!userLine && targetWords.length > 0) {
            userLine = lines.find((l: any) => {
                const lineNorm = normalizeText(l.text);
                // Match if ANY word from target appears in line
                return targetWords.some(word => lineNorm.includes(word));
            });
            if (userLine) {
                console.log(`[OCR] Found via partial match: "${userLine.text}"`);
            }
        }

        // Last resort: fuzzy similarity matching
        if (!userLine) {
            let bestMatch = { line: null as any, score: 0 };
            for (const line of lines) {
                const lineNorm = normalizeText(line.text);
                const score = similarity(lineNorm, normalizedTarget);
                if (score > bestMatch.score && score >= 0.5) {
                    bestMatch = { line, score };
                }
            }
            if (bestMatch.line) {
                userLine = bestMatch.line;
                console.log(`[OCR] Found via fuzzy match (${(bestMatch.score * 100).toFixed(0)}%): "${userLine.text}"`);
            }
        }

        if (!userLine) {
            console.log("[OCR] User not found after all matching attempts");
            return {
                found: false,
                date: foundDate,
                targetName: targetName,
                shift: '', startTime: '', endTime: '', colleagues: [],
                rawContext: `No se encontró "${targetName}" en el cuadrante.\n\nNombres detectados:\n${lines.slice(0, 30).map((l: any) => l.text).join('\n')}`
            };
        }

        console.log("User found at Y=" + userLine.top);

        // 6. Determine Context (Parent Section & Parent Time Column)

        // Find nearest Section Header ABOVE user
        let parentSection = sectionHeaders.filter((h: any) => h.bottom < userLine.top).pop();

        // New Simplified Logic: "First Valid Ancestor"
        // 1. Get all headers strictly above the user and within the current section
        const candidates = timeHeaders.filter((h: any) => {
            if (h.bottom > userLine.top) return false;
            if (parentSection && h.top < parentSection.bottom) return false;
            return true;
        });

        // 2. Sort candidates by Vertical Nearness (closest to user first = Descending Top)
        candidates.sort((a: any, b: any) => b.top - a.top);

        // 3. Find the first candidate that is "Reasonably Aligned" horizontally
        let parentTimeHeader = candidates.find((h: any) => {
            const centerDist = Math.abs(h.center - userLine.center);
            const verticalDist = userLine.top - h.bottom;

            // Heuristic:
            // - If it's very close vertically (< 50px), we can be strict horizontally.
            // - If it's far vertically, we must be strict horizontally to avoid drifting to neighbor columns.
            // - For Configurable Shifts (often just "M", "N"), width is small, so center align is key.

            // Rule 1: Must be reasonably close in center alignment (e.g. within 200px)
            // Rule 2: If it's a "narrow" header (width < 50), center dist must be tighter (e.g. 100) to be sure.

            const isNarrow = (h.right - h.left) < 60;
            const threshold = isNarrow ? 120 : 250;

            return centerDist < threshold;
        });


        // 7. Extract Data
        let service = parentSection ? parentSection.text : "Servicio Desconocido";

        let shift = parentTimeHeader ? parentTimeHeader.shiftType : "HORARIO NO DETECTADO";
        let start = parentTimeHeader ? parentTimeHeader.startTime : "--:--";
        let end = parentTimeHeader ? parentTimeHeader.endTime : "--:--";

        // 8. Find Colleagues
        const cols: string[] = [];

        if (parentTimeHeader) {
            const blockTop = parentSection ? parentSection.bottom : 0;
            const nextSectionY = sectionHeaders.find((s: any) => s.top > userLine.bottom)?.top || 100000;

            const refCenter = parentTimeHeader.center;

            lines.forEach((l: any) => {
                if (l === userLine) return; // Skip self

                // 1. Vertical Check: Must be in same Service Section
                if (l.top <= blockTop) return;
                if (l.top >= nextSectionY) return;

                // 2. Horizontal Check: Must be in same visual column
                //    Use a relaxed tolerance relative to the detected column
                const dist = Math.abs(l.center - refCenter);
                // 250px is generous but safe for preventing cross-column (unless columns are very packed)
                if (dist > 250) return;

                // 3. Filter Noise
                if (l.cleanText.includes("HORAS") && l.cleanText.includes("A")) return;
                if (l.cleanText.includes("SERVICIO")) return;

                // 4. Determine Schedule (Sub-headers logic) for mixed columns
                //    Find nearest header above THIS colleague, in the SAME column
                let closestSubHeader: any = null;
                const subCandidates = timeHeaders.filter((h: any) =>
                    h.bottom < l.top &&
                    h.top > blockTop &&
                    Math.abs(h.center - refCenter) < 80
                );
                if (subCandidates.length > 0) {
                    subCandidates.sort((a: any, b: any) => a.top - b.top);
                    closestSubHeader = subCandidates[subCandidates.length - 1];
                }

                let colStr = l.text;
                if (closestSubHeader) {
                    const myStart = closestSubHeader.startTime;
                    const myEnd = closestSubHeader.endTime;
                    // If sub-header time differs from Main Header time, append it
                    if ((myStart !== start || myEnd !== end) && myStart !== "--:--") {
                        colStr += ` (${myStart}-${myEnd})`;
                    }
                }

                cols.push(colStr);
            });
        }

        return {
            found: true,
            date: foundDate,
            targetName: targetName.toUpperCase(),
            shift: shift,
            service: service,
            startTime: start,
            endTime: end,
            colleagues: cols.length > 0 ? cols : ["Solo/a en este horario"],
            rawContext: `Detectado:\nServicio: ${service}\nHorario: ${shift} ${start}-${end}\n\nContexto Raw: ${parentSection?.text || 'N/A'} -> ${parentTimeHeader?.text || 'N/A'}`
        };

    } catch (e: any) {
        console.error("OCR.space Hierarchical Failed:", e);
        return null; // The caller (Dialog) will fallback
    }
}
