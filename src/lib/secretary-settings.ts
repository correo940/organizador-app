// ──────────────────────────────────────────────────────────────────────────────
// Quioba Secretaria — Configuración y helpers
// ──────────────────────────────────────────────────────────────────────────────

export type SecretaryPersonality = 'formal' | 'friendly' | 'sergeant';
export type SecretaryAvatarId =
  | 'avatar-admin' | 'avatar-tech' | 'avatar-tutor'
  | 'avatar-exec' | 'avatar-creative' | 'avatar-chef'
  | 'avatar-robot' | 'avatar-ninja' | 'avatar-mage'
  | 'avatar-detective' | 'avatar-pilot' | 'avatar-astronaut';

export interface SecretaryModules {
  tasks: boolean;
  shopping: boolean;
  medicines: boolean;
  finances: boolean;
  shifts: boolean;
}

export interface WeeklySyncConfig {
  enabled: boolean;
  dayOfWeek: number;  // 0=Domingo, 1=Lunes ... 6=Sábado
  time: string;       // "21:00"
}

export interface MonthlySyncConfig {
  enabled: boolean;
  dayOfMonth: number; // 1–28
  time: string;       // "21:00"
}

export interface SecretarySettings {
  enabled: boolean;
  syncTime: string;        // "21:30"
  briefingTime: string;    // "07:30"
  personality: SecretaryPersonality;
  avatarId: SecretaryAvatarId;
  modules: SecretaryModules;
  weeklySync: WeeklySyncConfig;
  monthlySync: MonthlySyncConfig;
  customName?: string;
}


// ── Avatares disponibles ────────────────────────────────────────────────────

export interface AvatarOption {
  id: SecretaryAvatarId;
  label: string;
  emoji: string;
  description: string;
}

export const SECRETARY_AVATARS: AvatarOption[] = [
  { id: 'avatar-admin', label: 'Elegante', emoji: '👩‍💼', description: 'Asistencia profesional y medida ' },
  { id: 'avatar-tech', label: 'Techie', emoji: '🧑‍💻', description: 'Enfoque técnico y rápido' },
  { id: 'avatar-tutor', label: 'Docente', emoji: '👩‍🏫', description: 'Metódico y educativo' },
  { id: 'avatar-exec', label: 'Ejecutivo', emoji: '👨‍💼', description: 'Decisiones formales' },
  { id: 'avatar-creative', label: 'Creativo', emoji: '🧑‍🎤', description: 'Inspiración moderna' },
  { id: 'avatar-chef', label: 'Práctico', emoji: '👨‍🍳', description: 'Planes al punto' },
  { id: 'avatar-ninja', label: 'Sigiloso', emoji: '🥷', description: 'Rápido, discreto y letal' },
  { id: 'avatar-mage', label: 'Mago', emoji: '🧙‍♂️', description: 'Trucos y atajos increíbles' },
  { id: 'avatar-detective', label: 'Analista', emoji: '🕵️‍♂️', description: 'Encuentra cualquier dato' },
  { id: 'avatar-pilot', label: 'Piloto', emoji: '🚀', description: 'Altas velocidades de acción' },
  { id: 'avatar-astronaut', label: 'Explorador', emoji: '👩‍🚀', description: 'Visión de largo plazo' },
  { id: 'avatar-robot', label: 'IA Pura', emoji: '🤖', description: 'Lógica algorítmica fría' },
];

// ── Textos por personalidad ──────────────────────────────────────────────────

export const PERSONALITY_TEXTS: Record<SecretaryPersonality, {
  syncNotifTitle: string;
  syncNotifBody: string;
  briefingNotifTitle: string;
  briefingNotifBody: string;
  syncWelcome: (name: string) => string;
  briefingGreeting: (name: string) => string;
  victoriesPrompt: string;
  confirmationMessage: string;
}> = {
  formal: {
    syncNotifTitle: 'Quioba — Revisión diaria',
    syncNotifBody: 'Es hora de planificar el día de mañana.',
    briefingNotifTitle: 'Su resumen del día está listo',
    briefingNotifBody: 'Buenos días. Aquí tiene su agenda de hoy.',
    syncWelcome: (name) => `Buenas noches, ${name}. Vamos a preparar el día de mañana.`,
    briefingGreeting: (name) => `Buenos días, ${name}. Su agenda de hoy es la siguiente.`,
    victoriesPrompt: '¿Qué logros puede registrar del día de hoy?',
    confirmationMessage: 'Planificación completada. Que descanse.',
  },
  friendly: {
    syncNotifTitle: '¡Hey! ¿Revisamos mañana? 🌙',
    syncNotifBody: 'Solo 2 minutitos y mañana irá de lujo 😊',
    briefingNotifTitle: '☀️ ¡Buenos días! Tu briefing está listo',
    briefingNotifBody: 'Aquí tienes todo para empezar el día con buen pie.',
    syncWelcome: (name) => `¡Buenas noches, ${name}! 🌙 Venga, vamos a dejar mañana listo para que puedas descansar tranquilo/a.`,
    briefingGreeting: (name) => `¡Buenos días, ${name}! ☀️ Hoy tiene buena pinta. Aquí va tu resumen:`,
    victoriesPrompt: '¿Qué cosas guapas has conseguido hoy? ¡Cuéntame! 🎉',
    confirmationMessage: '¡Todo listo! Mañana va a ir genial. ¡A dormir! 😴',
  },
  sergeant: {
    syncNotifTitle: 'Sync obligatorio. Entra.',
    syncNotifBody: 'Tienes 2 minutos. Mueve ficha.',
    briefingNotifTitle: 'Arriba. Tu agenda.',
    briefingNotifBody: 'Sin excusas. Aquí está todo lo de hoy.',
    syncWelcome: (name) => `${name}. Sync nocturno. Vamos al grano.`,
    briefingGreeting: (name) => `${name}. Son las X. Aquí está tu día. Presta atención.`,
    victoriesPrompt: 'Lista lo que cumpliste hoy. Sin rodeos.',
    confirmationMessage: 'Listo. Ahora a dormir. Mañana hay que rendir.',
  },
};

// ── Defaults y storage ────────────────────────────────────────────────────────

export const SECRETARY_SETTINGS_KEY = 'secretarySettings';

export const DEFAULT_SECRETARY_SETTINGS: SecretarySettings = {
  enabled: false,
  syncTime: '21:30',
  briefingTime: '07:30',
  personality: 'friendly',
  avatarId: 'avatar-admin',
  modules: {
    tasks: true,
    shopping: true,
    medicines: true,
    finances: true,
    shifts: true,
  },
  weeklySync: {
    enabled: false,
    dayOfWeek: 0, // Domingo
    time: '21:00',
  },
  monthlySync: {
    enabled: false,
    dayOfMonth: 1,
    time: '21:00',
  },
  customName: 'Quioba',
};

export function getSecretarySettings(): SecretarySettings {
  if (typeof window === 'undefined') return DEFAULT_SECRETARY_SETTINGS;
  try {
    const raw = localStorage.getItem(SECRETARY_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SECRETARY_SETTINGS };
    return { ...DEFAULT_SECRETARY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SECRETARY_SETTINGS };
  }
}

export function saveSecretarySettings(settings: SecretarySettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SECRETARY_SETTINGS_KEY, JSON.stringify(settings));
}

export function getAvatarById(id: SecretaryAvatarId): AvatarOption {
  return SECRETARY_AVATARS.find(a => a.id === id) ?? SECRETARY_AVATARS[0];
}

// ── Helper: nombre del usuario ────────────────────────────────────────────────

export function getUserFirstName(user: any): string {
  const nickname = user?.user_metadata?.nickname
    || user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'amigo/a';
  return nickname.split(' ')[0];
}
