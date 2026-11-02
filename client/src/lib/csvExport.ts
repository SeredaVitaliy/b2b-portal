import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Product } from "@b2b/shared";

function toRows(products: Product[]) {
  return products.map((p) => ({
    sku: p.sku,
    name: p.name,
    price: p.basePrice,
    stock: p.stock,
    unit: p.unit,
  }));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCatalogCsv(products: Product[]) {
  const csv = Papa.unparse(toRows(products));
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, "catalog.csv");
}

export function exportCatalogXlsx(products: Product[]) {
  const ws = XLSX.utils.json_to_sheet(toRows(products));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Каталог");
  XLSX.writeFile(wb, "catalog.xlsx");
}
