// =====================================================
// SHARED APPLICATION TYPES
// =====================================================

export type Animal = {
  id: string;
  species: 'goat' | 'sheep';
  breed: string;
  gender: 'male' | 'female';
  purpose: 'tarbiya' | 'tasmeen' | 'birth';
  status: 'alive' | 'dead';
  tag: string | null;
  notes: string | null;
  died_at: string | null;
  created_at: string;
};

export type Vaccination = {
  id: string;
  name: string;
  target_section: string;
  count: number;
  status: 'done' | 'pending' | 'overdue';
  scheduled_date: string | null;
  done_date: string | null;
  progress: number;
};

export type Note = {
  id: string;
  category: 'goat' | 'sheep' | 'general';
  body: string;
  tag: string | null;
  created_at?: string;
};

// ---- NEW LOCAL TYPES (stored in localStorage) ----

export type BreedingRecord = {
  id: string;
  female_tag: string;
  female_breed: string;
  female_species: 'goat' | 'sheep';
  male_tag: string;
  male_breed: string;
  mating_date: string;
  expected_birth: string;
  actual_birth: string | null;
  offspring_count: number | null;
  male_offspring: number | null;
  female_offspring: number | null;
  status: 'pregnant' | 'born' | 'failed' | 'pending';
  notes: string | null;
  created_at: string;
};

export type HealthRecord = {
  id: string;
  animal_tag: string;
  animal_breed: string;
  animal_species: 'goat' | 'sheep';
  date: string;
  diagnosis: string;
  medication: string;
  dosage: string;
  withdrawal_days: number;
  treatment_end: string;
  withdrawal_end: string;
  status: 'active' | 'completed';
  notes: string | null;
  created_at: string;
};

export type FinanceRecord = {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  notes: string | null;
  created_at: string;
};

export type AppNotification = {
  id: string;
  type: 'warning' | 'info' | 'success' | 'danger';
  title: string;
  message: string;
  date: string;
  read: boolean;
  source: 'vaccination' | 'breeding' | 'health' | 'finance' | 'system';
};

export type FarmSettings = {
  farmName: string;
  currency: string;
  ownerName: string;
  goatBreeds: string[];
  sheepBreeds: string[];
  vaccinationAlertDays: number;
  pregnancyDays: number;
};

export const DEFAULT_SETTINGS: FarmSettings = {
  farmName: 'بيان المزرعة',
  currency: 'ج.م',
  ownerName: 'مدير المزرعة',
  goatBreeds: ['شامي', 'بور', 'بلدي'],
  sheepBreeds: ['برقي', 'دوربر', 'ميت ماستر'],
  vaccinationAlertDays: 7,
  pregnancyDays: 150,
};

// ---- STORAGE HELPERS ----

const KEYS = {
  breeding: 'farm_breeding_records',
  health: 'farm_health_records',
  finance: 'farm_finance_records',
  notifications: 'farm_notifications',
  settings: 'farm_settings',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* silent */ }
}

export const BreedingStore = {
  getAll: (): BreedingRecord[] => load(KEYS.breeding, []),
  save: (records: BreedingRecord[]) => save(KEYS.breeding, records),
  add: (record: BreedingRecord) => {
    const all = load<BreedingRecord[]>(KEYS.breeding, []);
    save(KEYS.breeding, [record, ...all]);
  },
  update: (id: string, patch: Partial<BreedingRecord>) => {
    const all = load<BreedingRecord[]>(KEYS.breeding, []);
    save(KEYS.breeding, all.map(r => r.id === id ? { ...r, ...patch } : r));
  },
  delete: (id: string) => {
    const all = load<BreedingRecord[]>(KEYS.breeding, []);
    save(KEYS.breeding, all.filter(r => r.id !== id));
  },
};

export const HealthStore = {
  getAll: (): HealthRecord[] => load(KEYS.health, []),
  save: (records: HealthRecord[]) => save(KEYS.health, records),
  add: (record: HealthRecord) => {
    const all = load<HealthRecord[]>(KEYS.health, []);
    save(KEYS.health, [record, ...all]);
  },
  update: (id: string, patch: Partial<HealthRecord>) => {
    const all = load<HealthRecord[]>(KEYS.health, []);
    save(KEYS.health, all.map(r => r.id === id ? { ...r, ...patch } : r));
  },
  delete: (id: string) => {
    const all = load<HealthRecord[]>(KEYS.health, []);
    save(KEYS.health, all.filter(r => r.id !== id));
  },
};

export const FinanceStore = {
  getAll: (): FinanceRecord[] => load(KEYS.finance, []),
  save: (records: FinanceRecord[]) => save(KEYS.finance, records),
  add: (record: FinanceRecord) => {
    const all = load<FinanceRecord[]>(KEYS.finance, []);
    save(KEYS.finance, [record, ...all]);
  },
  delete: (id: string) => {
    const all = load<FinanceRecord[]>(KEYS.finance, []);
    save(KEYS.finance, all.filter(r => r.id !== id));
  },
};

export const NotificationStore = {
  getAll: (): AppNotification[] => load(KEYS.notifications, []),
  add: (n: AppNotification) => {
    const all = load<AppNotification[]>(KEYS.notifications, []);
    save(KEYS.notifications, [n, ...all].slice(0, 100));
  },
  markRead: (id: string) => {
    const all = load<AppNotification[]>(KEYS.notifications, []);
    save(KEYS.notifications, all.map(n => n.id === id ? { ...n, read: true } : n));
  },
  markAllRead: () => {
    const all = load<AppNotification[]>(KEYS.notifications, []);
    save(KEYS.notifications, all.map(n => ({ ...n, read: true })));
  },
  clearAll: () => save(KEYS.notifications, []),
};

export const SettingsStore = {
  get: (): FarmSettings => load(KEYS.settings, DEFAULT_SETTINGS),
  save: (settings: FarmSettings) => save(KEYS.settings, settings),
};

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
