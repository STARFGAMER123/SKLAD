'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarIcon,
  Filter,
  RotateCcw,
  Pencil,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  PackageSearch,
  FileText,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

import { useSkladStore } from '@/stores/sklad-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OperationRow {
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

type SortKey = 'id' | 'date' | 'type' | 'document' | 'object' | 'address' | 'material' | 'quantity' | 'employee' | 'balance';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

interface FilterState {
  startDate: Date | undefined;
  endDate: Date | undefined;
  type: string;
  material: string;
  address: string;
  object: string;
  document: string;
}

interface EditFormData {
  id: number;
  type: string;
  materialId: number;
  quantity: number;
  date: string;
  document: string;
  employeeId: number | null;
  object: string;
  address: string;
}

interface NegativeBalanceWarning {
  materialName: string;
  currentBalance: number;
  newBalance: number;
}

interface BatchOperation {
  id: number;
  date: string;
  type: string;
  document: string | null;
  material_id: number;
  quantity: number;
  employee_id: number | null;
  object: string | null;
  address: string | null;
  material_name: string | null;
  employee_name: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 50;

const COLUMN_HEADERS: { key: SortKey; label: string; sortable?: boolean }[] = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'date', label: 'Дата', sortable: true },
  { key: 'type', label: 'Тип', sortable: true },
  { key: 'document', label: 'Документ', sortable: true },
  { key: 'object', label: 'Объект', sortable: true },
  { key: 'address', label: 'Адрес', sortable: true },
  { key: 'material', label: 'Материал', sortable: true },
  { key: 'quantity', label: 'Кол-во', sortable: true },
  { key: 'employee', label: 'Сотрудник', sortable: true },
  { key: 'balance', label: 'Остаток', sortable: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd.MM.yyyy', { locale: ru });
  } catch {
    return dateStr;
  }
}

function formatDateForInput(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'yyyy-MM-dd');
  } catch {
    return dateStr;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MovementsTab() {
  const {
    operations,
    materials,
    employees,
    dailySummary,
    isLoading,
    fetchOperations,
    fetchMaterials,
    fetchEmployees,
    fetchBalances,
    fetchDailySummary,
  } = useSkladStore();

  // ── Filter state ──
  const [filters, setFilters] = useState<FilterState>({
    startDate: undefined,
    endDate: undefined,
    type: '',
    material: '',
    address: '',
    object: '',
    document: '',
  });

  // ── Sort state ──
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'date',
    direction: 'desc',
  });

  // ── Pagination state ──
  const [currentPage, setCurrentPage] = useState(1);

  // ── Edit dialog state ──
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Batch operations state (for edit dialog) ──
  const [batchOperations, setBatchOperations] = useState<BatchOperation[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchExpanded, setBatchExpanded] = useState(true);

  // ── Material combobox state ──
  const [materialComboboxOpen, setMaterialComboboxOpen] = useState(false);

  // ── Date picker states ──
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = useState(false);

  // ── Edit dialog material combobox ──
  const [editMaterialComboboxOpen, setEditMaterialComboboxOpen] = useState(false);

  // ── Negative balance warning dialog ──
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [warningInfo, setWarningInfo] = useState<NegativeBalanceWarning | null>(null);

  // ── Daily summary panel ──
  const [dailySummaryExpanded, setDailySummaryExpanded] = useState(true);

  // ─────────────────────────────────────────────────────────────────────────────
  // Data fetching
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchMaterials();
    fetchEmployees();
    fetchOperations();
    fetchBalances();
    fetchDailySummary();
  }, [fetchMaterials, fetchEmployees, fetchOperations, fetchBalances, fetchDailySummary]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Material lookup helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const materialNameToId = useMemo(() => {
    const map: Record<string, number> = {};
    materials.forEach((m) => {
      map[m.name] = m.id;
    });
    return map;
  }, [materials]);

  const materialIdToName = useMemo(() => {
    const map: Record<number, string> = {};
    materials.forEach((m) => {
      map[m.id] = m.name;
    });
    return map;
  }, [materials]);

  const employeeNameToId = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach((e) => {
      map[e.full_name] = e.id;
    });
    return map;
  }, [employees]);

  const employeeIdToName = useMemo(() => {
    const map: Record<number, string> = {};
    employees.forEach((e) => {
      map[e.id] = e.full_name;
    });
    return map;
  }, [employees]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Filter & Sort
  // ─────────────────────────────────────────────────────────────────────────────

  const applyFilters = useCallback(async () => {
    const params: Record<string, string> = {};
    if (filters.startDate) {
      params.start_date = format(filters.startDate, 'yyyy-MM-dd');
    }
    if (filters.endDate) {
      params.end_date = format(filters.endDate, 'yyyy-MM-dd');
    }
    if (filters.type && filters.type !== 'all') {
      params.type = filters.type;
    }
    if (filters.material) {
      params.material = filters.material;
    }
    if (filters.address.trim()) {
      params.address = filters.address.trim();
    }
    if (filters.object.trim()) {
      params.object = filters.object.trim();
    }
    if (filters.document.trim()) {
      params.document = filters.document.trim();
    }
    await Promise.all([fetchOperations(params), fetchDailySummary(params)]);
    setCurrentPage(1);
  }, [filters, fetchOperations, fetchDailySummary]);

  const resetFilters = useCallback(() => {
    setFilters({
      startDate: undefined,
      endDate: undefined,
      type: '',
      material: '',
      address: '',
      object: '',
      document: '',
    });
    setCurrentPage(1);
    fetchOperations();
    fetchDailySummary();
    toast.info('Фильтры сброшены');
  }, [fetchOperations, fetchDailySummary]);

  const sortedOperations = useMemo(() => {
    const sorted = [...operations] as OperationRow[];
    const { key, direction } = sortConfig;

    sorted.sort((a, b) => {
      const aVal = a[key] ?? '';
      const bVal = b[key] ?? '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      if (aStr < bStr) return direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [operations, sortConfig]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Pagination
  // ─────────────────────────────────────────────────────────────────────────────

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedOperations.length / ITEMS_PER_PAGE)),
    [sortedOperations.length]
  );

  const paginatedOperations = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedOperations.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedOperations, currentPage]);

  // Ensure current page is valid
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Sorting handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSort = useCallback(
    (key: SortKey) => {
      setSortConfig((prev) => {
        if (prev.key === key) {
          return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        }
        return { key, direction: 'asc' };
      });
    },
    []
  );

  const SortIcon = useCallback(
    ({ columnKey }: { columnKey: SortKey }) => {
      if (sortConfig.key !== columnKey) {
        return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
      }
      return sortConfig.direction === 'asc' ? (
        <ArrowUp className="ml-1 h-3 w-3" />
      ) : (
        <ArrowDown className="ml-1 h-3 w-3" />
      );
    },
    [sortConfig]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Edit dialog
  // ─────────────────────────────────────────────────────────────────────────────

  const fetchBatchOperations = useCallback(async (date: string, address: string | null) => {
    setBatchLoading(true);
    setBatchExpanded(true);
    try {
      const params = new URLSearchParams({ date });
      if (address) params.set('address', address);
      const res = await fetch(`/api/warehouse/operations-batch?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBatchOperations(data);
      }
    } catch {
      // silent fail
    } finally {
      setBatchLoading(false);
    }
  }, []);

  const openEditDialog = useCallback(
    (op: OperationRow) => {
      const materialId = materialNameToId[op.material] ?? 0;
      const employeeId = op.employee ? employeeNameToId[op.employee] ?? null : null;

      setEditFormData({
        id: op.id,
        type: op.type,
        materialId,
        quantity: op.quantity,
        date: formatDateForInput(op.date),
        document: op.document ?? '',
        employeeId,
        object: op.object ?? '',
        address: op.address ?? '',
      });
      setEditDialogOpen(true);

      // Fetch batch operations (same date + address)
      fetchBatchOperations(op.date, op.address);
    },
    [materialNameToId, employeeNameToId, fetchBatchOperations]
  );

  const doSaveEdit = useCallback(async () => {
    if (!editFormData) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/warehouse/operations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editFormData.id,
          type: editFormData.type,
          materialId: editFormData.materialId,
          quantity: editFormData.quantity,
          date: editFormData.date,
          document: editFormData.document || '',
          employeeId: editFormData.employeeId,
          object: editFormData.object,
          address: editFormData.address,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('Операция успешно обновлена');
        setEditDialogOpen(false);
        setEditFormData(null);
        setBatchOperations([]);
        // Refresh operations, balances and daily summary (sync with DB)
        await Promise.all([applyFilters(), fetchBalances()]);
      } else {
        toast.error(data.error || 'Ошибка при сохранении');
      }
    } catch {
      toast.error('Ошибка соединения с сервером');
    } finally {
      setIsSaving(false);
    }
  }, [editFormData, applyFilters, fetchBalances]);

  const handleSaveEdit = useCallback(async () => {
    if (!editFormData) return;

    if (!editFormData.materialId) {
      toast.error('Выберите материал');
      return;
    }
    if (!editFormData.quantity || editFormData.quantity <= 0) {
      toast.error('Укажите корректное количество');
      return;
    }
    if (!editFormData.date) {
      toast.error('Укажите дату');
      return;
    }

    // Check for negative balance before saving
    if (editFormData.type === 'расход') {
      try {
        const checkRes = await fetch('/api/warehouse/check-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: editFormData.type,
            materialId: editFormData.materialId,
            quantity: editFormData.quantity,
            editId: editFormData.id,
          }),
        });
        if (checkRes.ok) {
          const result = await checkRes.json();
          if (result.wouldBeNegative) {
            setWarningInfo({
              materialName: result.materialName,
              currentBalance: result.currentBalance,
              newBalance: result.newBalance,
            });
            setWarningDialogOpen(true);
            return; // Wait for user decision
          }
        }
      } catch {
        // If check fails, proceed with save
      }
    }

    // No negative balance warning, proceed directly
    await doSaveEdit();
  }, [editFormData, doSaveEdit]);

  const handleWarningConfirm = useCallback(async () => {
    setWarningDialogOpen(false);
    setWarningInfo(null);
    await doSaveEdit();
  }, [doSaveEdit]);

  const handleWarningCancel = useCallback(() => {
    setWarningDialogOpen(false);
    setWarningInfo(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Page navigation
  // ─────────────────────────────────────────────────────────────────────────────

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages]
  );

  const getPageNumbers = useCallback((): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    const total = totalPages;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (currentPage > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(total - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < total - 2) {
      pages.push('ellipsis');
    }

    pages.push(total);

    return pages;
  }, [currentPage, totalPages]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Summary stats
  // ─────────────────────────────────────────────────────────────────────────────

  const summaryStats = useMemo(() => {
    const total = operations.length;
    const incoming = operations.filter((o) => o.type === 'приход').length;
    const outgoing = operations.filter((o) => o.type === 'расход').length;
    return { total, incoming, outgoing };
  }, [operations]);

  // Batch summary
  const batchSummary = useMemo(() => {
    if (batchOperations.length === 0) return null;
    const incoming = batchOperations.filter((o) => o.type === 'приход');
    const outgoing = batchOperations.filter((o) => o.type === 'расход');
    return {
      total: batchOperations.length,
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
      incomingQty: incoming.reduce((s, o) => s + o.quantity, 0),
      outgoingQty: outgoing.reduce((s, o) => s + o.quantity, 0),
    };
  }, [batchOperations]);

  // ── Daily summary totals ──
  const dailySummaryTotals = useMemo(() => {
    if (dailySummary.length === 0) return null;
    const totalIncoming = dailySummary.reduce((s, d) => s + d.incoming_qty, 0);
    const totalOutgoing = dailySummary.reduce((s, d) => s + d.outgoing_qty, 0);
    const totalNet = dailySummary.reduce((s, d) => s + d.net_qty, 0);
    return { totalIncoming, totalOutgoing, totalNet, days: dailySummary.length };
  }, [dailySummary]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filter Card ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {/* Start Date */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Дата от</Label>
              <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'h-9 w-full justify-start gap-2 text-left font-normal',
                      !filters.startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                    {filters.startDate
                      ? format(filters.startDate, 'dd.MM.yyyy', { locale: ru })
                      : 'Выберите'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) => {
                      setFilters((prev) => ({ ...prev, startDate: date }));
                      setStartCalendarOpen(false);
                    }}
                    initialFocus
                    locale={ru}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Дата до</Label>
              <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'h-9 w-full justify-start gap-2 text-left font-normal',
                      !filters.endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                    {filters.endDate
                      ? format(filters.endDate, 'dd.MM.yyyy', { locale: ru })
                      : 'Выберите'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) => {
                      setFilters((prev) => ({ ...prev, endDate: date }));
                      setEndCalendarOpen(false);
                    }}
                    initialFocus
                    locale={ru}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Type Filter */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Тип операции</Label>
              <Select
                value={filters.type}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="приход">Приход</SelectItem>
                  <SelectItem value="расход">Расход</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Material Filter (Searchable Combobox) */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Материал</Label>
              <Popover
                open={materialComboboxOpen}
                onOpenChange={setMaterialComboboxOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={materialComboboxOpen}
                    className="h-9 w-full justify-start gap-2 font-normal"
                  >
                    <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    {filters.material || 'Все материалы'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Поиск материала..." />
                    <CommandList>
                      <CommandEmpty>Не найдено</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__all__"
                          onSelect={() => {
                            setFilters((prev) => ({ ...prev, material: '' }));
                            setMaterialComboboxOpen(false);
                          }}
                        >
                          <span className="text-muted-foreground">Все материалы</span>
                        </CommandItem>
                        {materials.map((m) => (
                          <CommandItem
                            key={m.id}
                            value={m.name}
                            onSelect={() => {
                              setFilters((prev) => ({ ...prev, material: m.name }));
                              setMaterialComboboxOpen(false);
                            }}
                          >
                            <span>{m.name}</span>
                            {m.category_name && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                {m.category_name}
                              </span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Address Filter */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Адрес</Label>
              <Input
                placeholder="Поиск по адресу..."
                value={filters.address}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, address: e.target.value }))
                }
                className="h-9"
              />
            </div>

            {/* Object Filter */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Объект</Label>
              <Input
                placeholder="Поиск по объекту..."
                value={filters.object}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, object: e.target.value }))
                }
                className="h-9"
              />
            </div>

            {/* Document Filter */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Документ</Label>
              <Input
                placeholder="Поиск по документу..."
                value={filters.document}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, document: e.target.value }))
                }
                className="h-9"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-transparent select-none">.</Label>
              <div className="flex gap-2">
                <Button
                  onClick={applyFilters}
                  disabled={isLoading}
                  size="sm"
                  className="h-9 flex-1"
                >
                  <Filter className="mr-1 h-3.5 w-3.5" />
                  Фильтровать
                </Button>
                <Button
                  onClick={resetFilters}
                  variant="outline"
                  size="sm"
                  className="h-9"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary Badges ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">
          Всего: {summaryStats.total}
        </Badge>
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">
          Приход: {summaryStats.incoming}
        </Badge>
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">
          Расход: {summaryStats.outgoing}
        </Badge>
        {totalPages > 1 && (
          <span className="ml-auto text-xs text-muted-foreground">
            Страница {currentPage} из {totalPages} ({sortedOperations.length} записей)
          </span>
        )}
      </div>

      {/* ── Daily Summary Panel ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Сводка по дням
              {dailySummaryTotals && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({dailySummaryTotals.days} дн.)
                </span>
              )}
            </CardTitle>
            <button
              type="button"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setDailySummaryExpanded(!dailySummaryExpanded)}
            >
              {dailySummaryExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Свернуть
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Развернуть
                </>
              )}
            </button>
          </div>
        </CardHeader>
        {dailySummaryExpanded && (
          <CardContent>
            {dailySummary.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
                <BarChart3 className="h-8 w-8 opacity-40" />
                <span className="text-sm">Нет данных для отображения</span>
              </div>
            ) : (
              <>
                <div className="max-h-[300px] overflow-y-auto sklad-scroll">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
                      <TableRow>
                        <TableHead className="text-xs">Дата</TableHead>
                        <TableHead className="text-xs text-right">
                          <span className="inline-flex items-center gap-1">
                            Приход (кол-во)
                          </span>
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          <span className="inline-flex items-center gap-1">
                            Расход (кол-во)
                          </span>
                        </TableHead>
                        <TableHead className="text-xs text-right">Сальдо</TableHead>
                        <TableHead className="text-xs text-right">Операций</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailySummary.map((day) => {
                        const netPositive = day.net_qty > 0;
                        const netNegative = day.net_qty < 0;
                        return (
                          <TableRow key={day.date} className="hover:bg-muted/50">
                            <TableCell className="text-sm font-medium">
                              {formatDate(day.date)}
                            </TableCell>
                            <TableCell className="text-sm font-mono text-right">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                +{day.incoming_qty}
                              </span>
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({day.incoming_count})
                              </span>
                            </TableCell>
                            <TableCell className="text-sm font-mono text-right">
                              <span className="font-semibold text-red-700 dark:text-red-400">
                                -{day.outgoing_qty}
                              </span>
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({day.outgoing_count})
                              </span>
                            </TableCell>
                            <TableCell className="text-sm font-mono text-right font-semibold">
                              <span
                                className={cn(
                                  netPositive && 'text-emerald-700 dark:text-emerald-400',
                                  netNegative && 'text-red-700 dark:text-red-400',
                                  !netPositive && !netNegative && 'text-muted-foreground'
                                )}
                              >
                                {netPositive && '+'}{day.net_qty}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground">
                              {day.incoming_count + day.outgoing_count}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* ── Daily Summary Totals Footer ── */}
                {dailySummaryTotals && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
                    <span className="text-xs font-medium text-muted-foreground">Итого:</span>
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Приход: {dailySummaryTotals.totalIncoming.toLocaleString('ru-RU')}
                    </Badge>
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 gap-1">
                      <TrendingUp className="h-3 w-3 rotate-180" />
                      Расход: {dailySummaryTotals.totalOutgoing.toLocaleString('ru-RU')}
                    </Badge>
                    <Badge
                      className={cn(
                        'gap-1',
                        dailySummaryTotals.totalNet >= 0
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      Сальдо: {dailySummaryTotals.totalNet >= 0 ? '+' : ''}{dailySummaryTotals.totalNet.toLocaleString('ru-RU')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      за {dailySummaryTotals.days} дн.
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Operations Table ────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span className="text-sm">Загрузка данных...</span>
            </div>
          ) : sortedOperations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <PackageSearch className="h-10 w-10 opacity-40" />
              <span className="text-sm">Операции не найдены</span>
              <span className="text-xs">
                Попробуйте изменить параметры фильтра
              </span>
            </div>
          ) : (
            <>
              <div className="max-h-[600px] overflow-y-auto overflow-x-auto sklad-scroll">
                <Table className="min-w-[1050px]">
                  <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
                    <TableRow>
                      {COLUMN_HEADERS.map((col) => (
                        <TableHead
                          key={col.key}
                          className={cn(
                            'cursor-pointer select-none',
                            col.sortable && 'hover:text-foreground'
                          )}
                          onClick={() => col.sortable && handleSort(col.key)}
                        >
                          <div className="flex items-center gap-0.5">
                            {col.label}
                            {col.sortable && <SortIcon columnKey={col.key} />}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {paginatedOperations.map((op, index) => {
                        const isIncoming = op.type === 'приход';
                        const isExpense = op.type === 'расход';
                        const balancePositive = op.balance > 0;
                        const balanceNegative = op.balance < 0;

                        return (
                          <motion.tr
                            key={op.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            transition={{ duration: 0.15, delay: index * 0.02 }}
                            className={cn(
                              'cursor-pointer border-b transition-colors hover:bg-muted/50',
                              isIncoming && 'border-l-4 border-l-emerald-500',
                              isExpense && 'border-l-4 border-l-red-500'
                            )}
                            onDoubleClick={() => openEditDialog(op)}
                            title="Двойной клик для редактирования"
                          >
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {op.id}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(op.date)}
                            </TableCell>
                            <TableCell>
                              {isIncoming ? (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                                  приход
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 text-xs">
                                  расход
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm max-w-[100px]">
                              {op.document ? (
                                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                  <FileText className="h-3 w-3 shrink-0" />
                                  {op.document}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {op.object || '—'}
                            </TableCell>
                            <TableCell className="text-sm max-w-[150px] truncate">
                              {op.address || '—'}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {op.material}
                            </TableCell>
                            <TableCell className="text-sm font-mono text-right">
                              <span
                                className={cn(
                                  'font-semibold',
                                  isIncoming && 'text-emerald-700 dark:text-emerald-400',
                                  isExpense && 'text-red-700 dark:text-red-400'
                                )}
                              >
                                {isIncoming ? '+' : '-'}
                                {op.quantity}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">
                              {op.employee || '—'}
                            </TableCell>
                            <TableCell className="text-sm font-mono text-right font-semibold">
                              <span
                                className={cn(
                                  balancePositive &&
                                    'text-emerald-700 dark:text-emerald-400',
                                  balanceNegative &&
                                    'text-red-700 dark:text-red-400',
                                  !balancePositive &&
                                    !balanceNegative &&
                                    'text-muted-foreground'
                                )}
                              >
                                {op.balance}
                              </span>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>

              {/* ── Pagination ─────────────────────────────────────────── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <div className="text-xs text-muted-foreground">
                    Показано {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(currentPage * ITEMS_PER_PAGE, sortedOperations.length)} из{' '}
                    {sortedOperations.length}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => goToPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    {getPageNumbers().map((page, idx) =>
                      page === 'ellipsis' ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="mx-1 text-xs text-muted-foreground"
                        >
                          ...
                        </span>
                      ) : (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="icon"
                          className="h-8 w-8 text-xs"
                          onClick={() => goToPage(page)}
                        >
                          {page}
                        </Button>
                      )
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) {
          setEditFormData(null);
          setBatchOperations([]);
        }
      }}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Редактирование операции #{editFormData?.id}
            </DialogTitle>
            <DialogDescription>
              Измените данные операции и нажмите «Сохранить»
            </DialogDescription>
          </DialogHeader>

          {editFormData && (
            <div className="flex flex-col gap-4 py-2">
              {/* Type + Date */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm">Тип</Label>
                  <Select
                    value={editFormData.type}
                    onValueChange={(value) =>
                      setEditFormData((prev) =>
                        prev ? { ...prev, type: value } : prev
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="приход">Приход</SelectItem>
                      <SelectItem value="расход">Расход</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm">Дата</Label>
                  <Input
                    type="date"
                    value={editFormData.date}
                    onChange={(e) =>
                      setEditFormData((prev) =>
                        prev ? { ...prev, date: e.target.value } : prev
                      )
                    }
                  />
                </div>
              </div>

              {/* Document */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Документ
                </Label>
                <Input
                  placeholder="Номер или описание документа..."
                  value={editFormData.document}
                  onChange={(e) =>
                    setEditFormData((prev) =>
                      prev ? { ...prev, document: e.target.value } : prev
                    )
                  }
                />
              </div>

              {/* Material */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Материал</Label>
                <Popover
                  open={editMaterialComboboxOpen}
                  onOpenChange={setEditMaterialComboboxOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={editMaterialComboboxOpen}
                      className="w-full justify-start gap-2 font-normal"
                    >
                      <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      {editFormData.materialId
                        ? materialIdToName[editFormData.materialId] || 'Выберите...'
                        : 'Выберите материал...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Поиск материала..." />
                      <CommandList>
                        <CommandEmpty>Не найдено</CommandEmpty>
                        <CommandGroup>
                          {materials.map((m) => (
                            <CommandItem
                              key={m.id}
                              value={m.name}
                              onSelect={() => {
                                setEditFormData((prev) =>
                                  prev ? { ...prev, materialId: m.id } : prev
                                );
                                setEditMaterialComboboxOpen(false);
                              }}
                            >
                              <span>{m.name}</span>
                              {m.category_name && (
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {m.category_name}
                                </span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Quantity + Employee */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm">Количество</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editFormData.quantity}
                    onChange={(e) =>
                      setEditFormData((prev) =>
                        prev
                          ? { ...prev, quantity: parseInt(e.target.value) || 0 }
                          : prev
                      )
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm">Сотрудник</Label>
                  <Select
                    value={
                      editFormData.employeeId !== null
                        ? String(editFormData.employeeId)
                        : '__none__'
                    }
                    onValueChange={(value) =>
                      setEditFormData((prev) =>
                        prev
                          ? {
                              ...prev,
                              employeeId:
                                value === '__none__'
                                  ? null
                                  : parseInt(value),
                            }
                          : prev
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Не указан" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Не указан</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={String(emp.id)}>
                          {emp.full_name}
                          {emp.position ? ` (${emp.position})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Object */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Объект</Label>
                <Input
                  placeholder="Название объекта..."
                  value={editFormData.object}
                  onChange={(e) =>
                    setEditFormData((prev) =>
                      prev ? { ...prev, object: e.target.value } : prev
                    )
                  }
                />
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Адрес</Label>
                <Input
                  placeholder="Адрес объекта..."
                  value={editFormData.address}
                  onChange={(e) =>
                    setEditFormData((prev) =>
                      prev ? { ...prev, address: e.target.value } : prev
                    )
                  }
                />
              </div>

              {/* ── Batch Materials Section ──────────────────────────────── */}
              {batchOperations.length > 0 && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
                      onClick={() => setBatchExpanded(!batchExpanded)}
                    >
                      <span className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-amber-600" />
                        Все материалы на эту дату и адрес
                        {batchSummary && (
                          <span className="text-xs text-muted-foreground font-normal">
                            ({batchSummary.total} поз.: {batchSummary.incomingQty} приход, {batchSummary.outgoingQty} расход)
                          </span>
                        )}
                      </span>
                      {batchExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {batchExpanded && (
                      <div className="max-h-[280px] overflow-y-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                              <TableHead className="text-xs">Тип</TableHead>
                              <TableHead className="text-xs">Материал</TableHead>
                              <TableHead className="text-xs text-right">Кол-во</TableHead>
                              <TableHead className="text-xs">Сотрудник</TableHead>
                              <TableHead className="text-xs">Документ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batchOperations.map((bop) => {
                              const isInc = bop.type === 'приход';
                              const isCurrent = bop.id === editFormData.id;
                              return (
                                <TableRow
                                  key={bop.id}
                                  className={cn(
                                    isCurrent && 'bg-blue-50 dark:bg-blue-950/30 font-medium',
                                    isInc && !isCurrent && 'border-l-2 border-l-emerald-400',
                                    !isInc && !isCurrent && 'border-l-2 border-l-red-400'
                                  )}
                                >
                                  <TableCell>
                                    <Badge
                                      className={cn(
                                        'text-xs',
                                        isInc
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                      )}
                                    >
                                      {bop.type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {bop.material_name || '—'}
                                    {isCurrent && (
                                      <span className="ml-1.5 text-xs text-blue-600 dark:text-blue-400">(текущая)</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm font-mono text-right">
                                    <span className={cn(
                                      'font-semibold',
                                      isInc && 'text-emerald-700 dark:text-emerald-400',
                                      !isInc && 'text-red-700 dark:text-red-400'
                                    )}>
                                      {isInc ? '+' : '-'}{bop.quantity}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {bop.employee_name || '—'}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {bop.document || '—'}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </>
              )}

              {batchLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Загрузка расходника...
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditFormData(null);
                setBatchOperations([]);
              }}
              disabled={isSaving}
            >
              Отмена
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Сохранение...
                </>
              ) : (
                'Сохранить'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Negative Balance Warning Dialog ─────────────────────── */}
      <AlertDialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="size-5" />
              Внимание: отрицательный остаток
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm">
                  При сохранении операции остаток материала станет отрицательным:
                </p>
                {warningInfo && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{warningInfo.materialName}</span>
                      <span className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          Остаток: <span className="font-mono">{warningInfo.currentBalance}</span>
                        </span>
                        <span className="text-red-600 dark:text-red-400 font-semibold">
                          → <span className="font-mono">{warningInfo.newBalance}</span>
                        </span>
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-sm">
                  Нажмите <strong>ОК</strong> для сохранения, или{' '}
                  <strong>Отмена</strong> для возврата к редактированию.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleWarningCancel}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWarningConfirm}
              className="bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-200"
            >
              ОК
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
