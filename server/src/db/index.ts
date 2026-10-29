import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config";

const here = dirname(fileURLToPath(import.meta.url));

// Путь к файлу БД считаем от текущей рабочей директории (server/).
const dbPath = resolve(process.cwd(), config.dbPath);
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL"); // быстрее и устойчивее при одновременном чтении/записи
db.pragma("foreign_keys = ON");

// Регистронезависимость для Unicode (кириллицы): встроенный SQLite LOWER/LIKE
// умеет сворачивать регистр только для ASCII. Своя функция через JS toLowerCase
// корректно работает и для русских названий. Используется в поиске по каталогу.
// Нормализация для поиска: нижний регистр + ё→е (чтобы «ёлка» и «елка» совпадали).
// Применяется и к названию/артикулу в БД, и к поисковому запросу — значит нормализация
// идёт с обеих сторон сравнения.
db.function("lower_u", { deterministic: true }, (value: unknown) =>
  value == null ? value : String(value).toLowerCase().replace(/ё/g, "е"),
);

/** Накатывает схему из schema.sql. Безопасно вызывать многократно. */
export function initSchema(): void {
  const schema = readFileSync(resolve(here, "schema.sql"), "utf-8");
  db.exec(schema);
}
