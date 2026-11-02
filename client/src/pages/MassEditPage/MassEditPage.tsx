import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  Button,
  Empty,
  InputNumber,
  message,
  Space,
  Spin,
  Typography,
} from "antd";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product, ProductBulkUpdate, BulkUpdateResult } from "@b2b/shared";
import { bulkUpdateProducts } from "@/api/ProductApi";
import { useAllProducts, PRODUCTS_QUERY_KEY } from "@/hooks/useAllProducts";
import { useElementSize } from "@/hooks/useElementSize";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setDraft,
  setSelected,
  fillSelected,
  clearSelection,
  setErrors,
  clearDrafts,
  type EditableField,
  type CellRef,
} from "@/slices/massEditSlice";
import { exportCatalogCsv, exportCatalogXlsx } from "@/lib/csvExport";

const ROW_HEIGHT = 56;

const FIELDS: EditableField[] = ["basePrice", "stock"];

interface RowData {
  products: Product[];
  drafts: Record<number, Partial<Record<EditableField, number>>>;
  errors: Record<number, string>;
  selectedSet: Set<string>;
  onCellMouseDown: (row: number, field: EditableField, e: MouseEvent) => void;
  onCellMouseEnter: (row: number, field: EditableField) => void;
  onCellChange: (
    id: number,
    field: EditableField,
    value: number | null,
  ) => void;
}

const cellKey = (id: number, field: EditableField) => `${id}:${field}`;

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const { products, drafts, errors, selectedSet } = data;
  const p = products[index];
  const err = errors[p.id];

  const cell = (field: EditableField, width: number) => {
    const draftVal = drafts[p.id]?.[field];
    const isDirty = draftVal !== undefined && draftVal !== p[field];
    const isSelected = selectedSet.has(cellKey(p.id, field));
    return (
      <div
        onMouseDown={(e) => data.onCellMouseDown(index, field, e)}
        onMouseEnter={() => data.onCellMouseEnter(index, field)}
        style={{
          padding: 2,
          borderRadius: 6,
          background: isSelected ? "#e6f4ff" : "transparent",
        }}
      >
        <InputNumber
          style={{
            width,
            ...(isDirty && !err ? { borderColor: "#faad14" } : {}),
          }}
          min={0}
          step={field === "basePrice" ? 0.01 : 1}
          precision={field === "stock" ? 0 : undefined}
          status={err ? "error" : undefined}
          value={draftVal ?? p[field]}
          onChange={(v) => data.onCellChange(p.id, field, v)}
        />
      </div>
    );
  };

  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 12px",
        borderBottom: "1px solid #f0f0f0",
        userSelect: "none",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {p.name}
        </div>
        <Typography.Text
          type={err ? "danger" : "secondary"}
          style={{ fontSize: 12 }}
        >
          {err ? err : `Арт. ${p.sku}`}
        </Typography.Text>
      </div>
      {cell("basePrice", 130)}
      {cell("stock", 110)}
    </div>
  );
}

export default function MassEditPage() {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { ref, width, height } = useElementSize<HTMLDivElement>();

  const { data: products = [], isLoading } = useAllProducts();
  const drafts = useAppSelector((s) => s.massEdit.drafts);
  const errors = useAppSelector((s) => s.massEdit.errors);
  const selected = useAppSelector((s) => s.massEdit.selected);

  const [fillValue, setFillValue] = useState<number | null>(null);

  const dragging = useRef(false);
  const anchor = useRef<{ row: number; field: EditableField } | null>(null);

  useEffect(() => {
    const up = () => (dragging.current = false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const selectedSet = useMemo(
    () => new Set(selected.map((c) => cellKey(c.id, c.field))),
    [selected],
  );

  const rangeCells = (
    a: { row: number; field: EditableField },
    b: { row: number; field: EditableField },
  ): CellRef[] => {
    const r1 = Math.min(a.row, b.row);
    const r2 = Math.max(a.row, b.row);
    const c1 = Math.min(FIELDS.indexOf(a.field), FIELDS.indexOf(b.field));
    const c2 = Math.max(FIELDS.indexOf(a.field), FIELDS.indexOf(b.field));
    const cells: CellRef[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        cells.push({ id: products[r].id, field: FIELDS[c] });
      }
    }
    return cells;
  };

  const onCellMouseDown = (
    row: number,
    field: EditableField,
    e: MouseEvent,
  ) => {
    const here: CellRef = { id: products[row].id, field };
    if (e.ctrlKey || e.metaKey) {
      const key = cellKey(here.id, field);
      const exists = selected.some((c) => cellKey(c.id, c.field) === key);
      dispatch(
        setSelected(
          exists
            ? selected.filter((c) => cellKey(c.id, c.field) !== key)
            : [...selected, here],
        ),
      );
      anchor.current = { row, field };
      return;
    }
    if (e.shiftKey && anchor.current) {
      dispatch(setSelected(rangeCells(anchor.current, { row, field })));
      return;
    }

    dragging.current = true;
    anchor.current = { row, field };
    dispatch(setSelected([here]));
  };

  const onCellMouseEnter = (row: number, field: EditableField) => {
    if (!dragging.current || !anchor.current) return;
    dispatch(setSelected(rangeCells(anchor.current, { row, field })));
  };

  const onCellChange = (
    id: number,
    field: EditableField,
    value: number | null,
  ) => dispatch(setDraft({ id, field, value }));

  const updates = useMemo<ProductBulkUpdate[]>(() => {
    const result: ProductBulkUpdate[] = [];
    for (const p of products) {
      const e = drafts[p.id];
      if (!e) continue;
      const u: ProductBulkUpdate = { id: p.id };
      let changed = false;
      if (e.basePrice !== undefined && e.basePrice !== p.basePrice) {
        u.basePrice = e.basePrice;
        changed = true;
      }
      if (e.stock !== undefined && e.stock !== p.stock) {
        u.stock = e.stock;
        changed = true;
      }
      if (changed) result.push(u);
    }
    return result;
  }, [products, drafts]);

  const mutation = useMutation({
    mutationFn: (ups: ProductBulkUpdate[]) => bulkUpdateProducts(ups),
    onMutate: async (ups) => {
      await queryClient.cancelQueries({ queryKey: PRODUCTS_QUERY_KEY });
      const previous = queryClient.getQueryData<Product[]>(PRODUCTS_QUERY_KEY);
      queryClient.setQueryData<Product[]>(PRODUCTS_QUERY_KEY, (old = []) =>
        old.map((p) => {
          const u = ups.find((x) => x.id === p.id);
          if (!u) return p;
          return {
            ...p,
            ...(u.basePrice !== undefined ? { basePrice: u.basePrice } : {}),
            ...(u.stock !== undefined ? { stock: u.stock } : {}),
          };
        }),
      );
      return { previous };
    },
    onError: (_err, _ups, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PRODUCTS_QUERY_KEY, context.previous);
      }
      message.error("Не удалось сохранить");
    },
    onSuccess: (results: BulkUpdateResult[], _ups, context) => {
      const failed: Record<number, string> = {};
      const okIds: number[] = [];
      for (const r of results) {
        if (r.ok) okIds.push(r.id);
        else failed[r.id] = r.error;
      }

      queryClient.setQueryData<Product[]>(PRODUCTS_QUERY_KEY, (old = []) =>
        old.map((p) => {
          const r = results.find((x) => x.id === p.id);
          if (!r) return p;
          if (r.ok) return r.product;
          const prev = context?.previous?.find((x) => x.id === p.id);
          return prev ?? p;
        }),
      );
      dispatch(clearDrafts(okIds));
      dispatch(setErrors(failed));
      if (Object.keys(failed).length > 0) {
        message.warning(
          `Сохранено: ${okIds.length}, с ошибками: ${Object.keys(failed).length}`,
        );
      } else {
        message.success(`Сохранено: ${okIds.length}`);
      }
    },
  });

  if (user?.role !== "admin" && user?.role !== "manager") {
    return (
      <Empty
        description="Раздел доступен только менеджерам и администраторам"
        style={{ padding: 60 }}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Typography.Title level={2} style={{ margin: 0 }}>
          Редактор цен и остатков
        </Typography.Title>
        <Space wrap>
          <InputNumber
            placeholder="Значение"
            min={0}
            value={fillValue}
            onChange={(v) => setFillValue(v)}
            style={{ width: 120 }}
          />
          <Button
            disabled={fillValue === null || selected.length === 0}
            onClick={() => {
              if (fillValue !== null) dispatch(fillSelected(fillValue));
              dispatch(clearSelection());
            }}
          >
            Применить к выделенным ({selected.length})
          </Button>
          <Typography.Text type="secondary">
            Изменено: {updates.length}
          </Typography.Text>
          <Button onClick={() => exportCatalogCsv(products)}>
            Экспорт CSV
          </Button>
          <Button onClick={() => exportCatalogXlsx(products)}>
            Экспорт Excel
          </Button>
          <Button
            onClick={() => {
              dispatch(clearDrafts(products.map((p) => p.id)));
              dispatch(clearSelection());
            }}
            disabled={updates.length === 0}
          >
            Сбросить
          </Button>
          <Button
            type="primary"
            loading={mutation.isPending}
            disabled={updates.length === 0}
            onClick={() => mutation.mutate(updates)}
          >
            Сохранить
          </Button>
        </Space>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "0 12px 8px",
          fontWeight: 600,
          color: "#8c8c8c",
        }}
      >
        <div style={{ flex: 1 }}>Товар</div>
        <div style={{ width: 134, textAlign: "center" }}>Цена</div>
        <div style={{ width: 114, textAlign: "center" }}>Остаток</div>
      </div>

      <Spin spinning={isLoading}>
        <div ref={ref} style={{ height: "calc(100vh - 240px)" }}>
          {width > 0 && (
            <FixedSizeList
              height={height}
              width={width}
              itemCount={products.length}
              itemSize={ROW_HEIGHT}
              itemData={{
                products,
                drafts,
                errors,
                selectedSet,
                onCellMouseDown,
                onCellMouseEnter,
                onCellChange,
              }}
            >
              {Row}
            </FixedSizeList>
          )}
        </div>
      </Spin>
    </div>
  );
}
