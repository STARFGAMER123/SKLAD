import { create } from 'zustand';

interface Category {
  id: number;
  name: string;
  description: string | null;
}

interface Material {
  id: number;
  name: string;
  category_id: number | null;
  description: string | null;
  category_name?: string;
}

interface Employee {
  id: number;
  full_name: string;
  position: string | null;
}

interface Operation {
  id: number;
  date: string;
  type: string;
  document: string | null;
  object: string | null;
  address: string | null;
  material: string;
  quantity: number;
  employee: string | null;
  balance: number;
}

interface BalanceItem {
  category_name: string | null;
  material_name: string;
  balance: number;
}

interface DailySummaryItem {
  date: string;
  incoming_qty: number;
  outgoing_qty: number;
  net_qty: number;
  incoming_count: number;
  outgoing_count: number;
}

interface DbStats {
  categories: number;
  materials: number;
  employees: number;
  operations: number;
  dbPath: string;
}

interface SkladState {
  // Data
  categories: Category[];
  materials: Material[];
  employees: Employee[];
  operations: Operation[];
  balances: BalanceItem[];
  dailySummary: DailySummaryItem[];
  dbStats: DbStats | null;

  // UI state
  activeTab: string;
  refSubTab: string;
  isLoading: boolean;

  // Actions
  setActiveTab: (tab: string) => void;
  setRefSubTab: (tab: string) => void;
  setLoading: (loading: boolean) => void;

  // Data fetching
  fetchCategories: () => Promise<void>;
  fetchMaterials: () => Promise<void>;
  fetchEmployees: () => Promise<void>;
  fetchOperations: (filters?: Record<string, string>) => Promise<void>;
  fetchBalances: (endDate?: string) => Promise<void>;
  fetchDailySummary: (filters?: Record<string, string>) => Promise<void>;
  fetchDbStats: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const api = (path: string, options?: RequestInit) => fetch(path, options).then(r => r.json());

export const useSkladStore = create<SkladState>((set, get) => ({
  categories: [],
  materials: [],
  employees: [],
  operations: [],
  balances: [],
  dailySummary: [],
  dbStats: null,
  activeTab: 'operations',
  refSubTab: 'categories',
  isLoading: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setRefSubTab: (tab) => set({ refSubTab: tab }),
  setLoading: (loading) => set({ isLoading: loading }),

  fetchCategories: async () => {
    const data = await api('/api/warehouse/categories');
    if (Array.isArray(data)) set({ categories: data });
  },

  fetchMaterials: async () => {
    const data = await api('/api/warehouse/materials');
    if (Array.isArray(data)) set({ materials: data });
  },

  fetchEmployees: async () => {
    const data = await api('/api/warehouse/employees');
    if (Array.isArray(data)) set({ employees: data });
  },

  fetchOperations: async (filters?: Record<string, string>) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v) params.set(k, v);
        });
      }
      const data = await api(`/api/warehouse/operations?${params.toString()}`);
      if (Array.isArray(data)) set({ operations: data });
      else set({ operations: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchBalances: async (endDate?: string) => {
    const params = endDate ? `?endDate=${endDate}` : '';
    const data = await api(`/api/warehouse/balance${params}`);
    if (Array.isArray(data)) set({ balances: data });
  },

  fetchDailySummary: async (filters?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
    }
    const data = await api(`/api/warehouse/daily-summary?${params.toString()}`);
    if (Array.isArray(data)) set({ dailySummary: data });
  },

  fetchDbStats: async () => {
    const data = await api('/api/warehouse/database');
    if (data && !data.error) set({ dbStats: data });
  },

  refreshAll: async () => {
    const { fetchCategories, fetchMaterials, fetchEmployees, fetchOperations, fetchBalances, fetchDailySummary, fetchDbStats } = get();
    await Promise.all([
      fetchCategories(),
      fetchMaterials(),
      fetchEmployees(),
      fetchOperations(),
      fetchBalances(),
      fetchDailySummary(),
      fetchDbStats(),
    ]);
  },
}));
