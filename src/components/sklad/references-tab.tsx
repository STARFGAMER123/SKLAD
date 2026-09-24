'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  FolderOpen,
  Package,
  Users,
  Loader2,
  Inbox,
} from 'lucide-react';

import { useSkladStore } from '@/stores/sklad-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Shared helpers ──────────────────────────────────────────────────────────

const rowVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.3, ease: 'easeOut' },
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

// ─── Categories Sub‑Tab ──────────────────────────────────────────────────────

function CategoriesTab() {
  const { categories, fetchCategories } = useSkladStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setFormName('');
    setFormDesc('');
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((cat: Category) => {
    setEditing(cat);
    setFormName(cat.name);
    setFormDesc(cat.description ?? '');
    setDialogOpen(true);
  }, []);

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Введите название категории');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch('/api/warehouse/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, name: formName.trim(), description: formDesc.trim() || null }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success('Категория обновлена');
      } else {
        const res = await fetch('/api/warehouse/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || null }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success('Категория добавлена');
      }
      setDialogOpen(false);
      await fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/warehouse/categories?id=${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Категория удалена');
      setDeleteTarget(null);
      await fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800">
            <FolderOpen className="size-3" />
            {categories.length}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Всего категорий
          </span>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="size-4 mr-1" />
          Добавить
        </Button>
      </div>

      <div className="rounded-lg border max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="sticky top-0 bg-background z-10">
              <TableHead className="w-20">ID</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="w-32 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {categories.length === 0 ? (
                <TableRow key="empty">
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Inbox className="size-10 opacity-40" />
                      <p className="text-sm">Категории пока не добавлены</p>
                      <p className="text-xs opacity-70">
                        Нажмите &laquo;Добавить&raquo;, чтобы создать первую категорию
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((cat, i) => (
                  <motion.tr
                    key={cat.id}
                    custom={i}
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="hover:bg-muted/50 border-b transition-colors"
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {cat.id}
                    </TableCell>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[300px] truncate">
                      {cat.description || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(cat)}
                          title="Изменить"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(cat)}
                          title="Удалить"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Редактировать категорию' : 'Новая категория'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Измените данные категории и нажмите «Сохранить»'
                : 'Заполните данные новой категории'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">Название</Label>
              <Input
                id="cat-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Например: Стройматериалы"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cat-desc">Описание</Label>
              <Input
                id="cat-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Необязательное описание"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить категорию{' '}
              <span className="font-semibold text-foreground">
                &laquo;{deleteTarget?.name}&raquo;
              </span>
              ? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="size-4 mr-1 animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Materials Sub‑Tab ───────────────────────────────────────────────────────

function MaterialsTab() {
  const { materials, categories, fetchMaterials, fetchCategories } = useSkladStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchMaterials();
    fetchCategories();
  }, [fetchMaterials, fetchCategories]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setFormName('');
    setFormCategoryId('');
    setFormDesc('');
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((mat: Material) => {
    setEditing(mat);
    setFormName(mat.name);
    setFormCategoryId(mat.category_id != null ? String(mat.category_id) : '');
    setFormDesc(mat.description ?? '');
    setDialogOpen(true);
  }, []);

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Введите название материала');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        categoryId: formCategoryId ? Number(formCategoryId) : null,
        description: formDesc.trim() || null,
      };
      if (editing) {
        const res = await fetch('/api/warehouse/materials', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...body }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success('Материал обновлён');
      } else {
        const res = await fetch('/api/warehouse/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success('Материал добавлен');
      }
      setDialogOpen(false);
      await fetchMaterials();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/warehouse/materials?id=${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Материал удалён');
      setDeleteTarget(null);
      await fetchMaterials();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800">
            <Package className="size-3" />
            {materials.length}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Всего материалов
          </span>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="size-4 mr-1" />
          Добавить
        </Button>
      </div>

      <div className="rounded-lg border max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="sticky top-0 bg-background z-10">
              <TableHead className="w-20">ID</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="w-32 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {materials.length === 0 ? (
                <TableRow key="empty">
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Inbox className="size-10 opacity-40" />
                      <p className="text-sm">Материалы пока не добавлены</p>
                      <p className="text-xs opacity-70">
                        Нажмите &laquo;Добавить&raquo;, чтобы создать первый материал
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                materials.map((mat, i) => (
                  <motion.tr
                    key={mat.id}
                    custom={i}
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="hover:bg-muted/50 border-b transition-colors"
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {mat.id}
                    </TableCell>
                    <TableCell className="font-medium">{mat.name}</TableCell>
                    <TableCell>
                      {mat.category_name ? (
                        <Badge variant="secondary" className="text-xs">
                          {mat.category_name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[250px] truncate">
                      {mat.description || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(mat)}
                          title="Изменить"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(mat)}
                          title="Удалить"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Редактировать материал' : 'Новый материал'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Измените данные материала и нажмите «Сохранить»'
                : 'Заполните данные нового материала'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="mat-name">Название</Label>
              <Input
                id="mat-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Например: Цемент М500"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Категория</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 && (
                    <SelectItem value="__none" disabled>
                      Нет доступных категорий
                    </SelectItem>
                  )}
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mat-desc">Описание</Label>
              <Input
                id="mat-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Необязательное описание"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить материал?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить материал{' '}
              <span className="font-semibold text-foreground">
                &laquo;{deleteTarget?.name}&raquo;
              </span>
              ? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="size-4 mr-1 animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Employees Sub‑Tab ───────────────────────────────────────────────────────

function EmployeesTab() {
  const { employees, fetchEmployees } = useSkladStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formFullName, setFormFullName] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setFormFullName('');
    setFormPosition('');
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((emp: Employee) => {
    setEditing(emp);
    setFormFullName(emp.full_name);
    setFormPosition(emp.position ?? '');
    setDialogOpen(true);
  }, []);

  const handleSave = async () => {
    if (!formFullName.trim()) {
      toast.error('Введите ФИО сотрудника');
      return;
    }
    setSaving(true);
    try {
      const body = {
        fullName: formFullName.trim(),
        position: formPosition.trim() || null,
      };
      if (editing) {
        const res = await fetch('/api/warehouse/employees', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...body }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success('Сотрудник обновлён');
      } else {
        const res = await fetch('/api/warehouse/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success('Сотрудник добавлен');
      }
      setDialogOpen(false);
      await fetchEmployees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/warehouse/employees?id=${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Сотрудник удалён');
      setDeleteTarget(null);
      await fetchEmployees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
            <Users className="size-3" />
            {employees.length}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Всего сотрудников
          </span>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="size-4 mr-1" />
          Добавить
        </Button>
      </div>

      <div className="rounded-lg border max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="sticky top-0 bg-background z-10">
              <TableHead className="w-20">ID</TableHead>
              <TableHead>ФИО</TableHead>
              <TableHead>Должность</TableHead>
              <TableHead className="w-32 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {employees.length === 0 ? (
                <TableRow key="empty">
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Inbox className="size-10 opacity-40" />
                      <p className="text-sm">Сотрудники пока не добавлены</p>
                      <p className="text-xs opacity-70">
                        Нажмите &laquo;Добавить&raquo;, чтобы добавить первого сотрудника
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((emp, i) => (
                  <motion.tr
                    key={emp.id}
                    custom={i}
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="hover:bg-muted/50 border-b transition-colors"
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {emp.id}
                    </TableCell>
                    <TableCell className="font-medium">{emp.full_name}</TableCell>
                    <TableCell>
                      {emp.position ? (
                        <Badge variant="secondary" className="text-xs">
                          {emp.position}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(emp)}
                          title="Изменить"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(emp)}
                          title="Удалить"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Редактировать сотрудника' : 'Новый сотрудник'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Измените данные сотрудника и нажмите «Сохранить»'
                : 'Заполните данные нового сотрудника'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="emp-name">ФИО</Label>
              <Input
                id="emp-name"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                placeholder="Например: Иванов Иван Иванович"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-position">Должность</Label>
              <Input
                id="emp-position"
                value={formPosition}
                onChange={(e) => setFormPosition(e.target.value)}
                placeholder="Например: Мастер"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сотрудника?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить сотрудника{' '}
              <span className="font-semibold text-foreground">
                &laquo;{deleteTarget?.full_name}&raquo;
              </span>
              ? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="size-4 mr-1 animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ReferencesTab() {
  const { refSubTab, setRefSubTab } = useSkladStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Справочники</h2>
        <p className="text-muted-foreground mt-1">
          Управление категориями, материалами и сотрудниками
        </p>
      </div>

      <Tabs value={refSubTab} onValueChange={setRefSubTab}>
        <TabsList>
          <TabsTrigger value="categories" className="gap-1.5">
            <FolderOpen className="size-4 text-blue-500" />
            Категории
          </TabsTrigger>
          <TabsTrigger value="materials" className="gap-1.5">
            <Package className="size-4 text-amber-500" />
            Материалы
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-1.5">
            <Users className="size-4 text-emerald-500" />
            Сотрудники
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="materials" className="mt-4">
          <MaterialsTab />
        </TabsContent>
        <TabsContent value="employees" className="mt-4">
          <EmployeesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
