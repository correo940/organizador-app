export interface PublicHoliday {
    id: string;
    startDate: string;
    endDate: string;
    type: string;
    name: {
        text: string;
        language: string;
    }[];
    nationwide: boolean;
}

export const SPANISH_REGIONS = [
    { code: "ES-AN", name: "Andalucía" },
    { code: "ES-AR", name: "Aragón" },
    { code: "ES-AS", name: "Asturias" },
    { code: "ES-IB", name: "Islas Baleares" },
    { code: "ES-CN", name: "Canarias" },
    { code: "ES-CB", name: "Cantabria" },
    { code: "ES-CM", name: "Castilla-La Mancha" },
    { code: "ES-CL", name: "Castilla y León" },
    { code: "ES-CT", name: "Cataluña" },
    { code: "ES-EX", name: "Extremadura" },
    { code: "ES-GA", name: "Galicia" },
    { code: "ES-MD", name: "Madrid" },
    { code: "ES-MC", name: "Murcia" },
    { code: "ES-NC", name: "Navarra" },
    { code: "ES-PV", name: "País Vasco" },
    { code: "ES-RI", name: "La Rioja" },
    { code: "ES-VC", name: "Comunidad Valenciana" },
    { code: "ES-CE", name: "Ceuta" },
    { code: "ES-ML", name: "Melilla" },
];

export async function fetchHolidays(year: number, regionCode?: string): Promise<PublicHoliday[]> {
    try {
        const url = `https://date.nager.at/api/v3/publicholidays/${year}/ES`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch holidays");

        const rawData: any[] = await response.json();

        // 1. Filter based on region
        const filtered = rawData.filter(item => {
            if (item.global) return true; // Always include national holidays
            if (regionCode && regionCode !== 'ALL') {
                return item.counties && item.counties.includes(regionCode);
            }
            return false;
        });

        // 2. Map to internal PublicHoliday interface
        return filtered.map((item: any) => ({
            id: item.date + item.localName, // Generate a unique-ish ID
            startDate: item.date,
            endDate: item.date,
            type: "Public",
            name: [{ text: item.localName, language: "es" }],
            nationwide: item.global
        }));
    } catch (error) {
        console.error("Error fetching holidays:", error);
        return [];
    }
}
