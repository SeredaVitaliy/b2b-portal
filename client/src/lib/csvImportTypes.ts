export interface ImportRowData {
  sku: string;
  basePrice: number;
  stock?: number;
}

export interface ParsedRow {
  line: number;
  raw: Record<string, string>;
  data?: ImportRowData;
  error?: string;
}

export interface WorkerResult {
  rows: ParsedRow[];
}
