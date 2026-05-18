import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'phantom-settings.json');

export interface PhantomConfig {
    xttsApiUrl: string;
    defaultVoice: string;
    svdApiUrl?: string;
}

export const getPhantomConfig = (): PhantomConfig => {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error reading phantom config:', e);
    }
    return {
        xttsApiUrl: '',
        defaultVoice: 'female_01.wav',
        svdApiUrl: ''
    };
};

export const savePhantomConfig = (config: Partial<PhantomConfig>) => {
    const current = getPhantomConfig();
    const updated = { ...current, ...config };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
    return updated;
};
