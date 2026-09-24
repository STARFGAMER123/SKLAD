'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import {
  Package, BookOpen, ArrowLeftRight, BarChart3, Database,
  Warehouse, Settings, Download, Upload, HardDrive, Shield,
  Loader2, FileText, Sun, Moon, Monitor, Info, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSkladStore } from '@/stores/sklad-store';
import OperationsTab from '@/components/sklad/operations-tab';
import ReferencesTab from '@/components/sklad/references-tab';
import { MovementsTab } from '@/components/sklad/movements-tab';
import ReportsTab from '@/components/sklad/reports-tab';

const tabs = [
  { id: 'operations', label: 'Операции', icon: Package, color: 'text-emerald-500' },
  { id: 'references', label: 'Справочники', icon: BookOpen, color: 'text-sky-500' },
  { id: 'movements', label: 'Движения', icon: ArrowLeftRight, color: 'text-amber-500' },
  { id: 'reports', label: 'Отчёты', icon: BarChart3, color: 'text-purple-500' },
];

// ─── Theme Toggle ─────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard next-themes hydration guard
  useEffect(() => setMounted(true), []);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="text-foreground" disabled>
        <Sun className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="text-foreground"
      onClick={cycleTheme}
      title={`Тема: ${theme === 'light' ? 'светлая' : theme === 'dark' ? 'тёмная' : 'системная'}`}
    >
      {theme === 'light' && <Sun className="w-4 h-4" />}
      {theme === 'dark' && <Moon className="w-4 h-4" />}
      {theme === 'system' && <Monitor className="w-4 h-4" />}
    </Button>
  );
}

// ─── Settings Dialog ─────────────────────────────────────────────────────────
function SettingsDialog() {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: 'light', label: 'Светлая', icon: Sun },
    { value: 'dark', label: 'Тёмная', icon: Moon },
    { value: 'system', label: 'Системная', icon: Monitor },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="text-foreground">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Настройки
          </DialogTitle>
          <DialogDescription>
            Настройте параметры приложения SKLAD
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Theme selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Тема оформления</Label>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isActive = theme === opt.value;
                return (
                  <Button
                    key={opt.value}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    className={cn('gap-1.5', !isActive && 'text-foreground')}
                    onClick={() => setTheme(opt.value)}
                  >
                    <Icon className="w-4 h-4" />
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Version info */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Информация</Label>
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Версия</span>
                <span className="font-medium">2.1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Совместимость</span>
                <span className="font-medium">Python-версия</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Фреймворк</span>
                <span className="font-medium">Next.js 16</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SkladPage() {
  const {
    activeTab, setActiveTab, dbStats, isLoading,
    fetchDbStats, refreshAll,
  } = useSkladStore();

  const [dbDialogOpen, setDbDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    refreshAll();
  }, []);

  const handleBackup = async () => {
    try {
      const res = await fetch('/api/warehouse/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Резервная копия создана`);
        await refreshAll();
      } else {
        toast.error(data.error || 'Ошибка создания бэкапа');
      }
    } catch {
      toast.error('Не удалось создать резервную копию');
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Выберите файл базы данных');
      return;
    }
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await fetch('/api/warehouse/import-db', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        const imp = data.imported;
        toast.success(
          `Импорт выполнён: ${imp?.categories || 0} кат., ${imp?.materials || 0} мат., ${imp?.employees || 0} сотр., ${imp?.operations || 0} оп.`
        );
        setImportDialogOpen(false);
        setImportFile(null);
        await refreshAll();
      } else {
        toast.error(data.error || 'Ошибка импорта');
      }
    } catch {
      toast.error('Не удалось импортировать базу данных');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/warehouse/download-db');
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Ошибка экспорта');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `SKLAD_export_${timestamp}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Файл экспорта скачан');
    } catch {
      toast.error('Не удалось экспортировать базу данных');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateDb = async (name: string) => {
    try {
      const res = await fetch('/api/warehouse/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', path: `db/${name}.db` }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('База данных создана');
        await refreshAll();
      } else {
        toast.error(data.error || 'Ошибка создания базы данных');
      }
    } catch {
      toast.error('Не удалось создать базу данных');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary shadow-lg">
                <Warehouse className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">SKLAD</h1>
                <p className="text-xs text-muted-foreground">Склад — система учёта</p>
              </div>
            </div>

            {/* Stats */}
            <div className="hidden md:flex items-center gap-2">
              {dbStats && (
                <>
                  <Badge variant="secondary" className="text-xs">
                    <Database className="w-3 h-3 mr-1" />
                    {dbStats.dbPath.split('/').pop()}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-sky-600 dark:text-sky-400">
                    {dbStats.categories} кат.
                  </Badge>
                  <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400">
                    {dbStats.materials} мат.
                  </Badge>
                  <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400">
                    {dbStats.employees} сотр.
                  </Badge>
                  <Badge variant="outline" className="text-xs text-purple-600 dark:text-purple-400">
                    {dbStats.operations} оп.
                  </Badge>
                </>
              )}
            </div>

            {/* Right controls: Theme, Settings, Database */}
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <SettingsDialog />

              <Dialog open={dbDialogOpen} onOpenChange={setDbDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" className="text-foreground" title="База данных">
                    <Database className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Управление базой данных</DialogTitle>
                    <DialogDescription>
                      Текущая БД: {dbStats?.dbPath || 'warehouse.db'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <CreateDbDialog onCreate={handleCreateDb} />
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={handleBackup}
                    >
                      <Shield className="w-4 h-4 text-sky-500" />
                      Создать резервную копию
                    </Button>
                    <Dialog open={importDialogOpen} onOpenChange={(open) => {
                      setImportDialogOpen(open);
                      if (!open) setImportFile(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-start gap-2">
                          <Upload className="w-4 h-4 text-emerald-500" />
                          Импорт из Python БД
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Импорт из Python</DialogTitle>
                          <DialogDescription>
                            Загрузите файл .db из Python-версии. Текущие данные будут заменены.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                          <div
                            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
                            onClick={() => document.getElementById('import-file-input')?.click()}
                          >
                            <Upload className="w-8 h-8 text-muted-foreground" />
                            <div className="text-center">
                              <p className="text-sm font-medium">
                                {importFile ? importFile.name : 'Нажмите для выбора файла'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Поддерживаются файлы .db (SQLite)
                              </p>
                            </div>
                            <input
                              id="import-file-input"
                              type="file"
                              accept=".db"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setImportFile(f);
                              }}
                            />
                          </div>
                          {importFile && (
                            <div className="flex items-center gap-2 rounded-md bg-muted p-3">
                              <FileText className="w-4 h-4 text-sky-500 shrink-0" />
                              <span className="text-sm truncate flex-1">{importFile.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {(importFile.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                            Отмена
                          </Button>
                          <Button
                            onClick={handleImport}
                            disabled={!importFile || isImporting}
                          >
                            {isImporting ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Импорт...</>
                            ) : 'Импортировать'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={handleExport}
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 text-purple-500" />
                      )}
                      Экспорт для Python
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-card border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                    'transition-all duration-200 whitespace-nowrap',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content — CSS hidden/block to preserve tab state */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6">
        <div className={activeTab === 'operations' ? 'block' : 'hidden'}>
          <OperationsTab />
        </div>
        <div className={activeTab === 'references' ? 'block' : 'hidden'}>
          <ReferencesTab />
        </div>
        <div className={activeTab === 'movements' ? 'block' : 'hidden'}>
          <MovementsTab />
        </div>
        <div className={activeTab === 'reports' ? 'block' : 'hidden'}>
          <ReportsTab />
        </div>
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 bg-card/80 backdrop-blur-md border-t border-border py-2 mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>SKLAD v2.1 — Склад: система учёта</span>
          <span>Совместимость с Python-версией</span>
        </div>
      </footer>
    </div>
  );
}

// ─── Create DB sub-component ─────────────────────────────────────────────────
function CreateDbDialog({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');

  return (
    <div className="flex gap-2">
      <Input
        placeholder="Имя базы данных"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name) {
            onCreate(name);
            setName('');
          }
        }}
      />
      <Button
        size="sm"
        disabled={!name}
        onClick={() => {
          onCreate(name);
          setName('');
        }}
      >
        <HardDrive className="w-4 h-4 mr-1" />
        Создать
      </Button>
    </div>
  );
}
