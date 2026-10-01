# SKLAD v3.1 — REST API контракт

Единый контракт для всех клиентов SKLAD-сервера: SKLAD_Client.exe (Windows),
веб-браузер (UI открывается прямо с сервера) и мобильные клиенты (Android).
Базовый адрес: `http://<IP-сервера>:<порт>` (по умолчанию **3270**).

Все ответы — JSON в кодировке UTF-8. Для `/api/*` разрешён CORS
(`Access-Control-Allow-Origin: *`, `src/middleware.ts`), методы:
GET, POST, PUT, PATCH, DELETE, OPTIONS (preflight → 204).

> **Изменение в v3.1:** жёсткая серверная защита от минуса УДАЛЕНА.
> Расход может увести баланс в отрицательный — операция проводится
> (200). Предупреждение — задача клиента: `POST /api/warehouse/check-balance`
> возвращает `wouldBeNegative: true` ДО проведения. Веб-UI показывает
> диалог-подтверждение и проводит операцию по «ОК».

## Коды ошибок

| HTTP | Когда | code |
|------|-------|------|
| 400 | ошибка валидации / бизнес-правило | — |
| 409 | база данных на сервере не выбрана | `DB_NOT_CONFIGURED` |
| 501 | нативный диалог недоступен (запуск не в SKLAD_Server) | `NO_CONTROL` |
| 500 | внутренняя ошибка | — |

Формат ошибки: `{ "error": "человекочитаемый текст", "code": "..." }`.

---

## 1. Управление сервером (`/api/server/*`)

### GET /api/server/health
Проверка доступности. Используется клиентом для коннекта и
реконнект-индикатора (поллинг каждые 5 с).
```json
{
  "ok": true, "service": "sklad-server", "version": "3.1.0",
  "dbConfigured": false, "dbPath": null,
  "dataDir": "C:\\SKLAD\\data",
  "hostname": "SERVER-PC", "platform": "Windows 10",
  "serverTime": "2026-09-25T15:00:00.000Z", "uptimeSec": 12
}
```

### GET /api/server/config
Текущий конфиг (`server-config.json` рядом с exe) и путь к нему.

### POST /api/server/config
Тело: `{ "port": 3270, "bind": "0.0.0.0", "dataDir": "...", "autostart": true }`.
При смене `port`/`bind` отвечает `restartRequired: true` (рестарт делает SKLAD_Server).

### GET /api/server/db/list
Файлы баз (*.db/*.sqlite/*.db3) в папке данных сервера + недавние.
Ответ: `{ "databases": [{ "path", "name", "size", "mtime", "selected" }] }`.

### POST /api/server/db/select
Тело: `{ "path": "C:\\SKLAD\\data\\warehouse.db" }` — выбрать существующую базу.
Путь сохраняется в конфиг (`selectedDb`) и восстанавливается при рестарте.
Ответ: `{ "ok": true, "dbPath": "..." }`.

### POST /api/server/db/pick
Открывает **нативный диалог выбора файла на серверном ПК** (окно Windows
у SKLAD_Server в трее). Работает только внутри SKLAD_Server, иначе 501
`NO_CONTROL`. Выбранный файл сразу становится текущей БД.

### POST /api/server/db/import
`multipart/form-data`, поле `file` — импорт файла базы с клиентского ПК
на сервер (в т.ч. базы Python-версии). Файл сохраняется в
`<dataDir>/uploads/` и выбирается как текущая БД. Лимит 1 ГБ.

### POST /api/server/db/create
Тело: `{ "name": "Склад №2" }` — создать новую пустую базу в папке данных
сервера (схема создаётся автоматически).

---

## 2. Данные склада (`/api/warehouse/*`)

> Все эндпоинты раздела требуют выбранную БД, иначе 409 `DB_NOT_CONFIGURED`.

| Метод и путь | Назначение |
|---|---|
| `GET/POST /api/warehouse/categories` · `PUT/DELETE ?id=` | Категории |
| `GET/POST /api/warehouse/materials` · `PUT/DELETE ?id=` | Материалы |
| `GET/POST /api/warehouse/employees` · `PUT/DELETE ?id=` | Сотрудники |
| `GET /api/warehouse/operations?...` | Журнал операций (фильтры) |
| `POST /api/warehouse/operations` | Приход/расход (или batch через `items[]`) |
| `PUT /api/warehouse/operations` · `DELETE ?id=` | Правка / удаление операции |
| `POST /api/warehouse/check-balance` | Прогноз баланса (предупреждение) |
| `GET /api/warehouse/operations-batch?date&address` | Операции той же партии |
| `GET /api/warehouse/balance?endDate=` | Остатки по материалам |
| `GET /api/warehouse/daily-summary?...` | Сводка по дням |
| `GET/POST /api/warehouse/custom-report` | Отчёт произвольный (JSON) |
| `GET /api/warehouse/export-xlsx?mode=balances\|operations\|both` | Excel-экспорт |
| `GET /api/warehouse/database` | Статистика БД (счётчики + путь) |
| `POST /api/warehouse/database` | Действия: switch/create/backup/import-python/export-python |
| `POST /api/warehouse/import-db` | Импорт .db (multipart, замена данных текущей БД) |
| `GET /api/warehouse/download-db` | Скачать файл текущей БД |

### POST /api/warehouse/operations — тело
```json
{
  "type": "приход | расход",
  "materialId": 1, "quantity": 70,
  "date": "2026-09-25",
  "document": "Д-1", "employeeId": null,
  "object": "Объект", "address": "Адрес",
  "items": [{ "materialId": 1, "quantity": 70 }]
}
```
Партия: либо `materialId/quantity`, либо массив `items[]`.

**Поведение при нехватке остатка (v3.1):** расход, превышающий остаток,
**проводится** — баланс материала уходит в минус. Ошибки 400
«Недостаточно материала…» больше НЕТ. Клиент ДО отправки обязан
вызвать `POST /api/warehouse/check-balance` (тело
`{ "type", "materialId", "quantity", "editId?" }`) и при
`wouldBeNegative: true` показать предупреждение
(`currentBalance` → `newBalance`, `materialName`), после подтверждения — провести.

---

## 3. Рекомендуемый сценарий клиента (v3.1)

1. Прочитать сохранённое подключение (`host`, `port`; у EXE-клиента —
   `%APPDATA%\SkladClient\config.json`).
2. `GET /api/server/health` (таймаут 2–3 с):
   - недоступен → экран «Подключение к серверу»;
   - `dbConfigured: false` → экран «БД не найдена» (pick / list / import / create);
   - иначе → рабочая область, фоновый поллинг health каждые 5 с.
3. Все запросы к данным — с baseUrl `http://host:port`.

Файл конфигурации сервера `server-config.json`:
```json
{ "port": 3270, "bind": "0.0.0.0", "controlPort": 3271,
  "dataDir": "", "autostart": false,
  "selectedDb": null, "recentDbs": [] }
```
