'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  FileDown,
  FileSpreadsheet,
  RefreshCw,
  Package,
  TrendingUp,
  Minus,
  TrendingDown,
  CalendarIcon,
  Layers,
  SlidersHorizontal,
  Search,
  X,
  Loader2,
  Download,
  Check,
} from 'lucide-react';

import { useSkladStore } from '@/stores/sklad-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BalanceItem {
  category_name: string | null;
  material_name: string;
  balance: number;
}

interface GroupedBalances {
  [category: string]: BalanceItem[];
}

interface CustomReportBalance {
  material_id: number;
  category_name: string | null;
  material_name: string;
  balance: number;
}

interface SelectedMaterial {
  id: number;
  name: string;
  categoryName: string | null;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: 'easeOut',
    },
  }),
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ReportsTab() {
  const { balances, isLoading, fetchBalances, categories, materials } = useSkladStore();

  const [endDate, setEndDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);

  useEffect(() => {
    fetchBalances(format(endDate, 'yyyy-MM-dd'));
  }, [fetchBalances]);

  const handleRefresh = useCallback(async () => {
    await fetchBalances(format(endDate, 'yyyy-MM-dd'));
    toast.success('Данные обновлены');
  }, [fetchBalances, endDate]);

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (date) {
        setEndDate(date);
        setCalendarOpen(false);
        fetchBalances(format(date, 'yyyy-MM-dd'));
      }
    },
    [fetchBalances]
  );

  const handleExportBalances = useCallback(async () => {
    setIsExporting(true);
    try {
      const dateStr = format(endDate, 'yyyy-MM-dd');
      const response = await fetch(
        `/api/warehouse/export-xlsx?mode=balances&endDate=${dateStr}`
      );
      if (!response.ok) {
        throw new Error('Ошибка экспорта');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SKLAD_остатки_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Остатки экспортированы в Excel');
    } catch {
      toast.error('Ошибка при экспорте остатков');
    } finally {
      setIsExporting(false);
    }
  }, [endDate]);

  const handleExportOperations = useCallback(async () => {
    setIsExporting(true);
    try {
      const dateStr = format(endDate, 'yyyy-MM-dd');
      const response = await fetch(
        `/api/warehouse/export-xlsx?mode=operations&endDate=${dateStr}`
      );
      if (!response.ok) {
        throw new Error('Ошибка экспорта');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SKLAD_операции_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Операции экспортированы в Excel');
    } catch {
      toast.error('Ошибка при экспорте операций');
    } finally {
      setIsExporting(false);
    }
  }, [endDate]);

  // Compute summary stats
  const stats = useMemo(() => {
    const total = balances.length;
    const positive = balances.filter((b) => b.balance > 0).length;
    const zero = balances.filter((b) => b.balance === 0).length;
    const negative = balances.filter((b) => b.balance < 0).length;
    return { total, positive, zero, negative };
  }, [balances]);

  // Group balances by category
  const grouped = useMemo<GroupedBalances>(() => {
    const groups: GroupedBalances = {};
    for (const item of balances) {
      const category = item.category_name || 'Без категории';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    }
    return groups;
  }, [balances]);

  const sortedCategories = useMemo(
    () => Object.keys(grouped).sort(),
    [grouped]
  );

  const getBalanceStyle = (balance: number) => {
    if (balance > 0) {
      return 'text-green-700 dark:text-green-400 border-l-4 border-l-green-500';
    }
    if (balance < 0) {
      return 'text-red-700 dark:text-red-400 border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/30';
    }
    return 'text-gray-500 dark:text-gray-400';
  };

  const formattedDate = format(endDate, 'dd MMMM yyyy', { locale: ru });

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6" />
            Отчёты
          </h2>
          <p className="text-muted-foreground mt-1">
            Отчёт показывает остатки материалов на конец выбранного периода
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Дата окончания периода
            </label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[240px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formattedDate}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={handleDateSelect}
                  locale={ru}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Action Buttons */}
          <Button
            onClick={handleRefresh}
            disabled={isLoading}
            variant="default"
          >
            <RefreshCw
              className={cn('h-4 w-4', isLoading && 'animate-spin')}
            />
            Обновить данные
          </Button>

          <Button
            onClick={handleExportBalances}
            disabled={isExporting || isLoading || balances.length === 0}
            variant="outline"
          >
            <FileDown className="h-4 w-4" />
            Экспорт Excel (остатки)
          </Button>

          <Button
            onClick={handleExportOperations}
            disabled={isExporting || isLoading}
            variant="outline"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Экспорт Excel (операции)
          </Button>

          {/* Custom Report Button */}
          <Button
            onClick={() => setCustomDialogOpen(true)}
            variant="default"
            className="bg-primary hover:bg-primary/90 gap-1.5"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Настраиваемый отчёт
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="gap-4 py-4">
            <CardHeader className="pb-0 pt-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Всего материалов
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="gap-4 py-4 border-green-200 dark:border-green-900">
            <CardHeader className="pb-0 pt-0">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                Положительный остаток
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {stats.positive}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          custom={2}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="gap-4 py-4 border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-0 pt-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Нулевой остаток
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2">
                <Minus className="h-5 w-5 text-gray-500" />
                <span className="text-2xl font-bold text-gray-500">
                  {stats.zero}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          custom={3}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="gap-4 py-4 border-red-200 dark:border-red-900">
            <CardHeader className="pb-0 pt-0">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">
                Отрицательный остаток
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                <span className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {stats.negative}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Balances Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Остатки материалов
            <Badge variant="secondary" className="ml-auto">
              по состоянию на {formattedDate}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : balances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">Нет данных</p>
              <p className="text-sm">
                Выберите другую дату или обновите данные
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[30%]">Категория</TableHead>
                    <TableHead className="w-[40%]">Материал</TableHead>
                    <TableHead className="w-[30%] text-right">
                      Остаток
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCategories.map((category) => {
                    const items = grouped[category];
                    return (
                      <CategoryGroup
                        key={category}
                        category={category}
                        items={items}
                        getBalanceStyle={getBalanceStyle}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Report Dialog */}
      <CustomReportDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        categories={categories}
        materials={materials}
        defaultDate={endDate}
      />
    </div>
  );
}

// ─── Category Group Sub-component ────────────────────────────────────────────

function CategoryGroup({
  category,
  items,
  getBalanceStyle,
}: {
  category: string;
  items: BalanceItem[];
  getBalanceStyle: (balance: number) => string;
}) {
  return (
    <>
      {/* Category Header Row */}
      <TableRow className="bg-muted/70 hover:bg-muted/70">
        <TableCell
          colSpan={3}
          className="font-semibold text-foreground py-2.5"
        >
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {category}
            <Badge variant="outline" className="ml-1 text-xs">
              {items.length}
            </Badge>
          </div>
        </TableCell>
      </TableRow>
      {/* Material Rows */}
      {items.map((item) => (
        <TableRow key={item.material_name} className={getBalanceStyle(item.balance)}>
          <TableCell className="text-muted-foreground">
            {item.category_name || 'Без категории'}
          </TableCell>
          <TableCell className="font-medium">{item.material_name}</TableCell>
          <TableCell className="text-right font-mono font-semibold">
            {item.balance > 0 ? '+' : ''}
            {item.balance.toLocaleString('ru-RU')}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ─── Custom Report Dialog ────────────────────────────────────────────────────

function CustomReportDialog({
  open,
  onOpenChange,
  categories,
  materials,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: number; name: string; description: string | null }[];
  materials: { id: number; name: string; category_id: number | null; category_name?: string }[];
  defaultDate: Date;
}) {
  // State
  const [reportDate, setReportDate] = useState<Date>(defaultDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Selected categories (checkboxes)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  // Selected individual materials (tags)
  const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterial[]>([]);

  // Report result
  const [reportData, setReportData] = useState<CustomReportBalance[] | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setReportDate(defaultDate);
      setSelectedCategoryIds([]);
      setSelectedMaterials([]);
      setReportData(null);
      setSearchValue('');
    }
  }, [open, defaultDate]);

  // Toggle category
  const toggleCategory = useCallback((catId: number) => {
    setSelectedCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  }, []);

  // Add material from search
  const addMaterial = useCallback((mat: { id: number; name: string; category_name?: string }) => {
    setSelectedMaterials(prev => {
      if (prev.some(m => m.id === mat.id)) return prev;
      return [...prev, { id: mat.id, name: mat.name, categoryName: mat.category_name || null }];
    });
    setSearchValue('');
    setSearchOpen(false);
  }, []);

  // Remove material
  const removeMaterial = useCallback((matId: number) => {
    setSelectedMaterials(prev => prev.filter(m => m.id !== matId));
  }, []);

  // Total selected material count (for display)
  const totalSelectedCount = useMemo(() => {
    // Count materials from selected categories
    const catMaterialIds = materials
      .filter(m => selectedCategoryIds.includes(m.category_id ?? -1))
      .map(m => m.id);
    // Count individual materials not already in categories
    const individualIds = selectedMaterials
      .filter(m => !catMaterialIds.includes(m.id))
      .map(m => m.id);
    return catMaterialIds.length + individualIds.length;
  }, [selectedCategoryIds, selectedMaterials, materials]);

  // Group materials by category for the search combobox
  const materialsByCategory = useMemo(() => {
    const groups: Record<string, typeof materials> = {};
    for (const mat of materials) {
      const catName = mat.category_name || 'Без категории';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(mat);
    }
    return groups;
  }, [materials]);

  // Generate report
  const handleGenerateReport = useCallback(async () => {
    if (totalSelectedCount === 0) {
      toast.error('Выберите хотя бы одно оборудование или категорию');
      return;
    }

    setIsLoadingReport(true);
    try {
      const dateStr = format(reportDate, 'yyyy-MM-dd');
      // Get individual material IDs (excluding those already covered by categories)
      const catMaterialIds = materials
        .filter(m => selectedCategoryIds.includes(m.category_id ?? -1))
        .map(m => m.id);
      const individualIds = selectedMaterials
        .filter(m => !catMaterialIds.includes(m.id))
        .map(m => m.id);

      const params = new URLSearchParams();
      params.set('endDate', dateStr);
      if (individualIds.length > 0) params.set('materialIds', individualIds.join(','));
      if (selectedCategoryIds.length > 0) params.set('categoryIds', selectedCategoryIds.join(','));

      const res = await fetch(`/api/warehouse/custom-report?${params.toString()}`);
      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setReportData(data.balances);
      toast.success(`Отчёт сформирован: ${data.balances.length} позиций`);
    } catch {
      toast.error('Ошибка формирования отчёта');
    } finally {
      setIsLoadingReport(false);
    }
  }, [reportDate, selectedCategoryIds, selectedMaterials, totalSelectedCount, materials]);

  // Export to Excel
  const handleExportExcel = useCallback(async () => {
    if (!reportData || reportData.length === 0) return;

    setIsExporting(true);
    try {
      const dateStr = format(reportDate, 'yyyy-MM-dd');
      const catMaterialIds = materials
        .filter(m => selectedCategoryIds.includes(m.category_id ?? -1))
        .map(m => m.id);
      const individualIds = selectedMaterials
        .filter(m => !catMaterialIds.includes(m.id))
        .map(m => m.id);

      const res = await fetch('/api/warehouse/custom-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endDate: dateStr,
          materialIds: individualIds,
          categoryIds: selectedCategoryIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Ошибка экспорта');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SKLAD_custom_report_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Настраиваемый отчёт экспортирован в Excel');
    } catch {
      toast.error('Ошибка при экспорте отчёта');
    } finally {
      setIsExporting(false);
    }
  }, [reportDate, reportData, selectedCategoryIds, selectedMaterials, materials]);

  // Format date for display
  const formattedReportDate = format(reportDate, 'dd MMMM yyyy', { locale: ru });

  // Group report data by category
  const groupedReport = useMemo(() => {
    if (!reportData) return {};
    const groups: Record<string, CustomReportBalance[]> = {};
    for (const item of reportData) {
      const cat = item.category_name || 'Без категории';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [reportData]);

  const sortedReportCategories = useMemo(
    () => Object.keys(groupedReport).sort(),
    [groupedReport]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            Настраиваемый отчёт
          </DialogTitle>
          <DialogDescription>
            Выберите оборудование и дату для формирования отчёта об остатках
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          <div className="space-y-5 py-2">
            {/* ─── Date Picker ─── */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Дата остатка</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[280px] justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formattedReportDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={reportDate}
                    onSelect={(d) => {
                      if (d) {
                        setReportDate(d);
                        setCalendarOpen(false);
                      }
                    }}
                    locale={ru}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* ─── Category Selection ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Категории оборудования</Label>
              <p className="text-xs text-muted-foreground">
                Выберите категории, чтобы включить всё оборудование из них
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((cat) => {
                  const isChecked = selectedCategoryIds.includes(cat.id);
                  const catCount = materials.filter(m => m.category_id === cat.id).length;
                  return (
                    <div
                      key={cat.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors cursor-pointer select-none',
                        isChecked
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      )}
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <Checkbox
                        checked={isChecked}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleCategory(cat.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{cat.name}</span>
                        <span className="text-xs text-muted-foreground">{catCount} поз.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Material Search (Combobox) ─── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Поиск оборудования</Label>
              <p className="text-xs text-muted-foreground">
                Добавьте конкретные позиции оборудования
              </p>
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <Search className="mr-2 h-4 w-4 shrink-0" />
                    {searchValue || 'Поиск по оборудованию...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={true}>
                    <CommandInput
                      placeholder="Введите название..."
                      value={searchValue}
                      onValueChange={setSearchValue}
                    />
                    <CommandList>
                      <CommandEmpty>Ничего не найдено</CommandEmpty>
                      {Object.entries(materialsByCategory)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([catName, mats]) => (
                          <CommandGroup key={catName} heading={catName}>
                            {mats.map((mat) => (
                              <CommandItem
                                key={mat.id}
                                value={mat.name}
                                onSelect={() => addMaterial(mat)}
                                className="flex items-center gap-2"
                              >
                                <Check className={cn(
                                  'h-4 w-4',
                                  selectedMaterials.some(m => m.id === mat.id) ? 'opacity-100' : 'opacity-0'
                                )} />
                                <span>{mat.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* ─── Selected Materials Tags ─── */}
            {selectedMaterials.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Выбранное оборудование ({selectedMaterials.length})
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMaterials.map((mat) => (
                    <Badge
                      key={mat.id}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      <span className="max-w-[200px] truncate">{mat.name}</span>
                      <button
                        onClick={() => removeMaterial(mat.id)}
                        className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Selection Summary ─── */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Всего выбрано оборудования:</span>
                <span className="font-semibold">{totalSelectedCount} поз.</span>
              </div>
              {selectedCategoryIds.length > 0 && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Категорий:</span>
                  <span className="font-medium">{selectedCategoryIds.length}</span>
                </div>
              )}
              {selectedMaterials.length > 0 && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Индивидуальных позиций:</span>
                  <span className="font-medium">{selectedMaterials.length}</span>
                </div>
              )}
            </div>

            {/* ─── Generate Button ─── */}
            <Button
              onClick={handleGenerateReport}
              disabled={isLoadingReport || totalSelectedCount === 0}
              className="w-full"
            >
              {isLoadingReport ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Формирование...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Сформировать отчёт
                </>
              )}
            </Button>

            {/* ─── Report Results Table ─── */}
            {reportData && reportData.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Результат отчёта
                    <Badge variant="secondary">{reportData.length} поз.</Badge>
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Экспорт Excel
                  </Button>
                </div>

                <div className="max-h-[300px] overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[30%]">Категория</TableHead>
                        <TableHead className="w-[40%]">Оборудование</TableHead>
                        <TableHead className="w-[30%] text-right">Остаток</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedReportCategories.map((cat) => {
                        const items = groupedReport[cat];
                        return (
                          <React.Fragment key={cat}>
                            <TableRow className="bg-muted/70 hover:bg-muted/70">
                              <TableCell colSpan={3} className="font-semibold text-foreground py-2">
                                <div className="flex items-center gap-2">
                                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                  {cat}
                                  <Badge variant="outline" className="text-xs">{items.length}</Badge>
                                </div>
                              </TableCell>
                            </TableRow>
                            {items.map((item) => (
                              <TableRow key={item.material_id} className={cn(
                                item.balance > 0 && 'text-green-700 dark:text-green-400',
                                item.balance < 0 && 'text-red-700 dark:text-red-400',
                                item.balance === 0 && 'text-muted-foreground',
                              )}>
                                <TableCell className="text-muted-foreground text-sm">
                                  {item.category_name || 'Без категории'}
                                </TableCell>
                                <TableCell className="font-medium text-sm">{item.material_name}</TableCell>
                                <TableCell className="text-right font-mono font-semibold text-sm">
                                  {item.balance > 0 ? '+' : ''}{item.balance.toLocaleString('ru-RU')}
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {reportData && reportData.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Нет данных по выбранному оборудованию</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-3 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
