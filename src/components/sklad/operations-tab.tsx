'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  CalendarIcon,
  ArrowDownCircle,
  ArrowUpCircle,
  Package,
  Loader2,
  User,
  FileText,
  MapPin,
  Building2,
  AlertTriangle,
} from 'lucide-react';

import { useSkladStore } from '@/stores/sklad-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

// ---------- types ----------

interface OperationItem {
  id: string;
  materialId: number | null;
  quantity: string;
}

type OperationType = 'приход' | 'расход';

interface NegativeBalanceWarning {
  materialName: string;
  currentBalance: number;
  newBalance: number;
}

// ---------- helpers ----------

let nextItemId = 0;
function createItemId() {
  return `item-${++nextItemId}-${Date.now()}`;
}

function formatDateForApi(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

// ---------- component ----------

export default function OperationsTab() {
  const {
    materials,
    employees,
    balances,
    refreshAll,
    fetchBalances,
  } = useSkladStore();

  // --- form state ---
  const [opType, setOpType] = useState<OperationType>('приход');
  const [date, setDate] = useState<Date>(new Date());
  const [document, setDocument] = useState('');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [object, setObject] = useState('');
  const [address, setAddress] = useState('');
  const [items, setItems] = useState<OperationItem[]>([
    { id: createItemId(), materialId: null, quantity: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- negative balance warning dialog ---
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [pendingWarnings, setPendingWarnings] = useState<NegativeBalanceWarning[]>([]);
  const [pendingSubmitResolve, setPendingSubmitResolve] = useState<((proceed: boolean) => void) | null>(null);

  // --- popover open states ---
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false);
  const [materialPopoverOpen, setMaterialPopoverOpen] = useState<string | null>(null);

  // --- sync balances on mount ---
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // ---------- derived ----------

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId),
    [employees, employeeId],
  );

  /** Quick lookup: materialId -> balance */
  const balanceMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of balances) {
      const mat = materials.find((mt) => mt.name === b.material_name);
      if (mat) m.set(mat.id, b.balance);
    }
    return m;
  }, [balances, materials]);

  // ---------- items helpers ----------

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { id: createItemId(), materialId: null, quantity: '' },
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const updateItemMaterial = useCallback((id: string, materialId: number | null) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, materialId } : i)),
    );
  }, []);

  const updateItemQuantity = useCallback((id: string, quantity: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i)),
    );
  }, []);

  // ---------- negative balance check ----------

  const checkForNegativeBalance = useCallback(async (
    parsedItems: { materialId: number; quantity: number }[],
  ): Promise<NegativeBalanceWarning[]> => {
    if (opType !== 'расход') return [];

    try {
      const warnings: NegativeBalanceWarning[] = [];
      // Check each item against the server for accurate balance
      for (const item of parsedItems) {
        const res = await fetch('/api/warehouse/check-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: opType,
            materialId: item.materialId,
            quantity: item.quantity,
          }),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.wouldBeNegative) {
            warnings.push({
              materialName: result.materialName,
              currentBalance: result.currentBalance,
              newBalance: result.newBalance,
            });
          }
        }
      }
      return warnings;
    } catch {
      // If check fails, proceed silently (user can still submit)
      return [];
    }
  }, [opType]);

  // ---------- submit with warning ----------

  const doSubmit = useCallback(async (
    parsedItems: { materialId: number; quantity: number }[],
  ) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/warehouse/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: opType,
          materialId: parsedItems[0].materialId,
          quantity: parsedItems[0].quantity,
          date: formatDateForApi(date),
          document: document.trim(),
          employeeId: employeeId ?? undefined,
          object: object.trim() || undefined,
          address: address.trim() || undefined,
          items: parsedItems,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Ошибка при проведении операции');
        return;
      }

      toast.success(
        opType === 'приход'
          ? 'Приход успешно проведён'
          : 'Расход успешно проведён',
      );

      // Reset form
      setDocument('');
      setEmployeeId(null);
      setObject('');
      setAddress('');
      setItems([{ id: createItemId(), materialId: null, quantity: '' }]);

      // Refresh store data (including balances for sync)
      await refreshAll();
    } catch {
      toast.error('Не удалось подключиться к серверу');
    } finally {
      setIsSubmitting(false);
    }
  }, [items, document, date, opType, employeeId, object, address, refreshAll]);

  const handleSubmit = useCallback(async () => {
    // Validation
    if (!document.trim()) {
      toast.error('Укажите номер документа');
      return;
    }

    const parsedItems = items
      .map((item) => ({
        materialId: item.materialId,
        quantity: parseFloat(item.quantity),
      }))
      .filter((item) => item.materialId != null && !isNaN(item.quantity) && item.quantity > 0);

    if (parsedItems.length === 0) {
      toast.error('Добавьте хотя бы один материал с количеством');
      return;
    }

    // Check for negative balance
    const warnings = await checkForNegativeBalance(parsedItems);

    if (warnings.length > 0) {
      // Show warning dialog and wait for user decision
      setPendingWarnings(warnings);
      setWarningDialogOpen(true);

      // We'll handle the resolution in the dialog callbacks
      return new Promise<void>((resolve) => {
        setPendingSubmitResolve(() => async (proceed: boolean) => {
          if (proceed) {
            await doSubmit(parsedItems);
          }
          resolve();
        });
      });
    }

    // No warnings, proceed directly
    await doSubmit(parsedItems);
  }, [items, document, opType, checkForNegativeBalance, doSubmit]);

  // ---------- dialog handlers ----------

  const handleWarningConfirm = useCallback(async () => {
    setWarningDialogOpen(false);
    if (pendingSubmitResolve) {
      await pendingSubmitResolve(true);
      setPendingSubmitResolve(null);
    }
    setPendingWarnings([]);
  }, [pendingSubmitResolve]);

  const handleWarningCancel = useCallback(() => {
    setWarningDialogOpen(false);
    if (pendingSubmitResolve) {
      pendingSubmitResolve(false);
      setPendingSubmitResolve(null);
    }
    setPendingWarnings([]);
  }, [pendingSubmitResolve]);

  // ---------- render ----------

  const isIncome = opType === 'приход';

  return (
    <div className="space-y-6">
      {/* ───── Operation Form Card ───── */}
      <motion.div
        whileHover={{ y: -1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {isIncome ? (
                <ArrowDownCircle className="size-5 text-emerald-600" />
              ) : (
                <ArrowUpCircle className="size-5 text-red-500" />
              )}
              Новая операция
              <Badge
                className={cn(
                  'ml-2',
                  isIncome
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800'
                    : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800',
                )}
                variant="outline"
              >
                {opType}
              </Badge>
            </CardTitle>
            <CardDescription>
              Заполните данные для проведения складской операции
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* --- Row 1: Type + Date + Document --- */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr_2fr]">
              {/* Type */}
              <div className="space-y-2">
                <Label htmlFor="op-type">Тип операции</Label>
                <Select
                  value={opType}
                  onValueChange={(v) => setOpType(v as OperationType)}
                >
                  <SelectTrigger
                    id="op-type"
                    className={cn(
                      'w-full',
                      isIncome && 'border-emerald-300 focus-visible:ring-emerald-200 dark:border-emerald-700',
                      !isIncome && 'border-red-300 focus-visible:ring-red-200 dark:border-red-700',
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="приход">
                      <span className="flex items-center gap-2">
                        <ArrowDownCircle className="size-4 text-emerald-600" />
                        приход
                      </span>
                    </SelectItem>
                    <SelectItem value="расход">
                      <span className="flex items-center gap-2">
                        <ArrowUpCircle className="size-4 text-red-500" />
                        расход
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label>Дата</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'flex-1 justify-start text-left font-normal',
                          !date && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {date ? format(date, 'dd.MM.yyyy', { locale: ru }) : 'Выберите дату'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => d && setDate(d)}
                        locale={ru}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="secondary"
                    onClick={() => setDate(new Date())}
                    className="shrink-0"
                  >
                    Сегодня
                  </Button>
                </div>
              </div>

              {/* Document */}
              <div className="space-y-2">
                <Label htmlFor="document" className="flex items-center gap-1.5">
                  <FileText className="size-3.5" />
                  Номер документа
                </Label>
                <Input
                  id="document"
                  placeholder="Например: ДОК-001"
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                />
              </div>
            </div>

            {/* --- Row 2: Employee + Object + Address --- */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Employee */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <User className="size-3.5" />
                  Сотрудник
                </Label>
                <Popover
                  open={employeePopoverOpen}
                  onOpenChange={setEmployeePopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={employeePopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedEmployee
                        ? selectedEmployee.full_name
                        : 'Выберите сотрудника...'}
                      <span className="text-muted-foreground ml-2 text-xs">
                        {selectedEmployee?.position || ''}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Поиск сотрудника..." />
                      <CommandList>
                        <CommandEmpty>Сотрудники не найдены</CommandEmpty>
                        <CommandGroup>
                          {employees.map((emp) => (
                            <CommandItem
                              key={emp.id}
                              value={emp.full_name}
                              onSelect={() => {
                                setEmployeeId(emp.id === employeeId ? null : emp.id);
                                setEmployeePopoverOpen(false);
                              }}
                            >
                              <User className="mr-2 size-4 shrink-0 text-muted-foreground" />
                              <span className="flex-1 truncate">{emp.full_name}</span>
                              {emp.position && (
                                <span className="text-muted-foreground truncate text-xs">
                                  {emp.position}
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

              {/* Object */}
              <div className="space-y-2">
                <Label htmlFor="object" className="flex items-center gap-1.5">
                  <Building2 className="size-3.5" />
                  Объект
                </Label>
                <Input
                  id="object"
                  placeholder="Название объекта"
                  value={object}
                  onChange={(e) => setObject(e.target.value)}
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  Адрес
                </Label>
                <Input
                  id="address"
                  placeholder="Адрес доставки"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ───── Materials Table Card ───── */}
      <motion.div
        whileHover={{ y: -1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <Card className="gap-4">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="size-5" />
                  Материалы
                </CardTitle>
                <CardDescription>
                  Добавьте материалы и укажите количество
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addItem}
                className="w-fit"
              >
                <Plus className="size-4" />
                Добавить строку
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Материал</TableHead>
                    <TableHead className="w-32">Количество</TableHead>
                    <TableHead className="w-24">Остаток</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const material = item.materialId
                      ? materials.find((m) => m.id === item.materialId)
                      : null;
                    const currentBalance = item.materialId
                      ? balanceMap.get(item.materialId)
                      : undefined;

                    return (
                      <TableRow key={item.id}>
                        {/* Row number */}
                        <TableCell className="text-center text-muted-foreground font-medium">
                          {index + 1}
                        </TableCell>

                        {/* Material selector */}
                        <TableCell>
                          <Popover
                            open={materialPopoverOpen === item.id}
                            onOpenChange={(open) =>
                              setMaterialPopoverOpen(open ? item.id : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={materialPopoverOpen === item.id}
                                className="w-full justify-start font-normal"
                              >
                                {material ? (
                                  <span className="flex items-center gap-2 truncate">
                                    <Package className="size-3.5 shrink-0 text-muted-foreground" />
                                    {material.name}
                                    {material.category_name && (
                                      <span className="text-muted-foreground text-xs">
                                        ({material.category_name})
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    Выберите материал...
                                  </span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[--radix-popover-trigger-width] p-0"
                              align="start"
                            >
                              <Command>
                                <CommandInput placeholder="Поиск материала..." />
                                <CommandList>
                                  <CommandEmpty>Материалы не найдены</CommandEmpty>
                                  <CommandGroup>
                                    {materials.map((mat) => (
                                      <CommandItem
                                        key={mat.id}
                                        value={mat.name}
                                        onSelect={() => {
                                          updateItemMaterial(
                                            item.id,
                                            mat.id === item.materialId ? null : mat.id,
                                          );
                                          setMaterialPopoverOpen(null);
                                        }}
                                      >
                                        <Package className="mr-2 size-4 shrink-0 text-muted-foreground" />
                                        <span className="flex-1 truncate">{mat.name}</span>
                                        {mat.category_name && (
                                          <span className="text-muted-foreground truncate text-xs">
                                            {mat.category_name}
                                          </span>
                                        )}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </TableCell>

                        {/* Quantity */}
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItemQuantity(item.id, e.target.value)
                            }
                            className="h-8"
                          />
                        </TableCell>

                        {/* Current balance */}
                        <TableCell>
                          {currentBalance !== undefined ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                                    currentBalance > 0
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                      : currentBalance === 0
                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                  )}
                                >
                                  {currentBalance}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Текущий остаток: {currentBalance}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        {/* Remove */}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-red-500"
                            onClick={() => removeItem(item.id)}
                            disabled={items.length <= 1}
                            aria-label="Удалить строку"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Process operation button */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm">
                Добавлено материалов:{' '}
                <span className="font-medium text-foreground">
                  {items.filter((i) => i.materialId != null).length}
                </span>
              </p>
              <Button
                size="lg"
                onClick={() => handleSubmit()}
                disabled={isSubmitting}
                className={cn(
                  'min-w-[200px] font-semibold',
                  isIncome
                    ? 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-200 dark:bg-emerald-700 dark:hover:bg-emerald-800'
                    : 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-200 dark:bg-red-700 dark:hover:bg-red-800',
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Обработка...
                  </>
                ) : (
                  <>
                    {isIncome ? (
                      <ArrowDownCircle className="size-4" />
                    ) : (
                      <ArrowUpCircle className="size-4" />
                    )}
                    Провести операцию
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ───── Negative Balance Warning Dialog ───── */}
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
                  При проведении операции остаток следующих материалов станет отрицательным:
                </p>
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 space-y-2">
                  {pendingWarnings.map((w, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{w.materialName}</span>
                      <span className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          Остаток: <span className="font-mono">{w.currentBalance}</span>
                        </span>
                        <span className="text-red-600 dark:text-red-400 font-semibold">
                          → <span className="font-mono">{w.newBalance}</span>
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-sm">
                  Вы можете нажать <strong>ОК</strong> для продолжения операции, или{' '}
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
