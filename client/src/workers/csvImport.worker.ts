/// <reference lib="webworker" />
import Papa from "papaparse";
import { z } from "zod";
import type { ParsedRow } from "@/lib/csvImportTypes";

declare const self: DedicatedWorkerGlobalScope;

const numField = (label: string, opts: { int?: boolean } = {}) =>
  z
    .string()
    .trim()
    .min(1, `${label}: пусто`)
    .transform((s) => Number(s.replace(",", ".")))
    .refine((n) => Number.isFinite(n), `${label}: не число`)
    .refine((n) => n >= 0, `${label}: отрицательное`)
    .refine((n) => !opts.int || Number.isInteger(n), `${label}: не целое`);

const rowSchema = z.object({
  sku: z.string().trim().min(1, "Пустой SKU"),
  price: numField("Цена"),
  stock: numField("Остаток", { int: true }).optional(),
});

self.onmessage = (e: MessageEvent<string>) => {
  const parsed = Papa.parse<Record<string, string>>(e.data, {
    header: true,
    skipEmptyLines: true,
  });

  const seen = new Set<string>();
  const rows: ParsedRow[] = parsed.data.map((raw, i) => {
    const line = i + 2;
    const candidate: Record<string, unknown> = {
      sku: raw.sku,
      price: raw.price,
    };
    if (raw.stock !== undefined && String(raw.stock).trim() !== "") {
      candidate.stock = raw.stock;
    }

    const res = rowSchema.safeParse(candidate);
    if (!res.success) {
      return { line, raw, error: res.error.issues[0].message };
    }
    const { sku, price, stock } = res.data;
    if (seen.has(sku)) {
      return { line, raw, error: `Дубликат SKU: ${sku}` };
    }
    seen.add(sku);
    return {
      line,
      raw,
      data: {
        sku,
        basePrice: price,
        ...(stock !== undefined ? { stock } : {}),
      },
    };
  });

  self.postMessage({ rows });
};
