const STORAGE_SCHEMA_VERSION = '2026-03-27-1';
const STORAGE_VERSION_KEY = 'quioba_storage_schema_version';

const APP_LOCAL_KEYS = [
  'quioba_quick_apps',
  'quioba_quick_actions_order',
  'quioba_ai_insight_v2',
  'quioba_ai_insight_v2_date',
  'dailyNotificationSettings',
  'savingsNotificationSettings',
  'savingsNotificationLastShown',
  'postItSettings',
  'holiday_region_es',
  'custom_holidays_es',
  'tasks',
  'magicPoints',
  'currentStreak',
];

function clearKeyIfPresent(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup errors.
  }
}

export function ensureCompatibleBrowserStorage() {
  if (typeof window === 'undefined') return;

  try {
    const currentVersion = window.localStorage.getItem(STORAGE_VERSION_KEY);
    if (currentVersion === STORAGE_SCHEMA_VERSION) return;

    APP_LOCAL_KEYS.forEach(clearKeyIfPresent);

    // NOTE: We intentionally do NOT clear 'sb-*' keys here.
    // Those are Supabase auth session tokens. Deleting them logs the user out.

    window.localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_SCHEMA_VERSION);
  } catch {
    // Ignore storage cleanup errors.
  }
}
