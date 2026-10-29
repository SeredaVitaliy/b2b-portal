import type { ReactNode } from "react";

// Латинская буква на той же физической клавише → кириллица (QWERTY → ЙЦУКЕН).
const layoutMap: Record<string, string> = {
  q: "й", w: "ц", e: "у", r: "к", t: "е", y: "н", u: "г", i: "ш", o: "щ",
  p: "з", "[": "х", "]": "ъ",
  a: "ф", s: "ы", d: "в", f: "а", g: "п", h: "р", j: "о", k: "л", l: "д",
  ";": "ж", "'": "э",
  z: "я", x: "ч", c: "с", v: "м", b: "и", n: "т", m: "ь", ",": "б", ".": "ю",
};

function hasCyrillic(s: string): boolean {
  return /[а-яё]/i.test(s);
}

// Перевод из неверной раскладки: латиница → кириллица по клавишам.
function fixLayout(s: string): string {
  return s.replace(/[a-z[\];',.]/g, (ch) => layoutMap[ch] ?? ch);
}

/**
 * Нормализует поисковый запрос:
 * - обрезает и схлопывает пробелы, приводит к нижнему регистру;
 * - чинит раскладку, если ввели латиницей (нет кириллицы, есть латиница) —
 *   но только для «чистой» латиницы без цифр/дефиса, чтобы не ломать поиск
 *   по артикулу (SKU вида baka-0035);
 * - заменяет ё на е (на бэке lower_u делает то же, значит сравнение совпадёт).
 */
export function normalizeSearch(raw: string): string {
  let s = raw.trim().replace(/\s+/g, " ").toLowerCase();
  if (!hasCyrillic(s) && /[a-z]/.test(s) && !/[0-9-]/.test(s)) {
    s = fixLayout(s);
  }
  return s.replace(/ё/g, "е");
}

/**
 * Подсвечивает первое совпадение query в text, оборачивая его в <mark>.
 * Сравнение регистронезависимо и ё/е-независимо; длина при нормализации
 * не меняется, поэтому вырезаем исходный текст по той же длине.
 */
export function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text;
  const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");
  const idx = norm(text).indexOf(norm(query));
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
