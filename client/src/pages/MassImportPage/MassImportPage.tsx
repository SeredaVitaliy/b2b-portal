import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Progress,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { PriceImportRow, ImportRowResult } from "@b2b/shared";
import { importProducts } from "@/api/ProductApi";
import { useAppSelector } from "@/store/hooks";
import type { ParsedRow, WorkerResult } from "@/lib/csvImportTypes";

const BATCH_SIZE = 100;

interface ImportReport {
  imported: number;
  rejected: Array<{ sku: string; error: string }>;
}

export default function MassImportPage() {
  const user = useAppSelector((state) => state.auth.user);

  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<ImportReport | null>(null);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("../../workers/csvImport.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e: MessageEvent<WorkerResult>) => {
      setRows(e.data.rows);
      setParsing(false);
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const handleFile = async (file: File) => {
    setReport(null);
    setRows([]);
    setParsing(true);
    const text = await file.text();
    workerRef.current?.postMessage(text);
  };

  const validRows = useMemo(
    () => rows.filter((r) => r.data).map((r) => r.data as PriceImportRow),
    [rows],
  );
  const invalidCount = rows.length - validRows.length;

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setProgress(0);
    setReport(null);

    const serverResults: ImportRowResult[] = [];
    try {
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const chunk = validRows.slice(i, i + BATCH_SIZE);
        const res = await importProducts(chunk);
        serverResults.push(...res);
        setProgress(
          Math.round(
            (Math.min(i + BATCH_SIZE, validRows.length) / validRows.length) *
              100,
          ),
        );
      }

      const clientRejected = rows
        .filter((r) => r.error)
        .map((r) => ({
          sku: r.raw.sku || "(пусто)",
          error: r.error as string,
        }));
      const serverRejected = serverResults
        .filter((r) => !r.ok)
        .map((r) => ({ sku: r.sku, error: (r as { error: string }).error }));

      setReport({
        imported: serverResults.filter((r) => r.ok).length,
        rejected: [...clientRejected, ...serverRejected],
      });
      message.success("Импорт завершён");
    } catch {
      message.error("Импорт прервался — проверьте соединение");
    } finally {
      setImporting(false);
    }
  };

  if (user?.role !== "admin" && user?.role !== "manager") {
    return (
      <Empty
        description="Раздел доступен только менеджерам и администраторам"
        style={{ padding: 60 }}
      />
    );
  }

  const columns = [
    { title: "Строка", dataIndex: "line", width: 90 },
    { title: "SKU", render: (_: unknown, r: ParsedRow) => r.raw.sku },
    { title: "Цена", render: (_: unknown, r: ParsedRow) => r.raw.price },
    { title: "Остаток", render: (_: unknown, r: ParsedRow) => r.raw.stock },
    {
      title: "Статус",
      render: (_: unknown, r: ParsedRow) =>
        r.error ? (
          <Tag color="red">{r.error}</Tag>
        ) : (
          <Tag color="green">ок</Tag>
        ),
    },
  ];

  return (
    <div>
      <Typography.Title level={2}>Импорт прайс-листа из CSV</Typography.Title>
      <Typography.Paragraph type="secondary">
        Формат: столбцы <code>sku,price,stock</code> (остаток необязателен).
        Парсинг и проверка идут в фоне, импортируются только валидные строки.
      </Typography.Paragraph>

      <Upload.Dragger
        accept=".csv"
        showUploadList={false}
        multiple={false}
        beforeUpload={(file) => {
          handleFile(file);
          return false;
        }}
        disabled={parsing || importing}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Перетащите CSV сюда или нажмите</p>
      </Upload.Dragger>

      {rows.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              margin: "16px 0",
            }}
          >
            <Typography.Text>
              Всего строк: {rows.length} · валидных:{" "}
              <b style={{ color: "#16a34a" }}>{validRows.length}</b> · с
              ошибками: <b style={{ color: "#cf1322" }}>{invalidCount}</b>
            </Typography.Text>
            <Button
              type="primary"
              loading={importing}
              disabled={validRows.length === 0}
              onClick={handleImport}
            >
              Импортировать валидные ({validRows.length})
            </Button>
          </div>

          {importing && <Progress percent={progress} status="active" />}

          {report && (
            <Alert
              type={report.rejected.length > 0 ? "warning" : "success"}
              showIcon
              style={{ marginBottom: 16 }}
              message={`Импортировано: ${report.imported}, отклонено: ${report.rejected.length}`}
              description={
                report.rejected.length > 0 ? (
                  <div style={{ maxHeight: 160, overflow: "auto" }}>
                    {report.rejected.map((r, i) => (
                      <div key={i} style={{ fontSize: 12 }}>
                        <b>{r.sku}</b> — {r.error}
                      </div>
                    ))}
                  </div>
                ) : undefined
              }
            />
          )}

          <Table
            size="small"
            rowKey="line"
            columns={columns}
            dataSource={rows}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            onRow={(r) => ({
              style: r.error ? { background: "#fff1f0" } : undefined,
            })}
          />
        </>
      )}

      {parsing && (
        <Typography.Text type="secondary">Разбираем файл…</Typography.Text>
      )}
    </div>
  );
}
