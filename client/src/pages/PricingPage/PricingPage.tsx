import { useMemo, useState } from "react";
import {
  Button,
  Empty,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getCategories } from "@/api/ProductApi";
import {
  getClients,
  getPriceOverrides,
  setPriceOverride,
  deletePriceOverride,
} from "@/api/PricingApi";
import { useAllProducts } from "@/hooks/useAllProducts";
import { resolvePrice } from "@/lib/pricing";
import { formatPrice } from "@/lib/product";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectCompany,
  setProductDraft,
  setCategoryDraft,
  clearDrafts,
} from "@/slices/pricingSlice";
import type { Product, PriceOverrides } from "@b2b/shared";

const EMPTY_OVERRIDES: PriceOverrides = {
  companyId: 0,
  products: {},
  categories: {},
};

export default function PricingPage() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const companyId = useAppSelector((s) => s.pricing.companyId);
  const productDrafts = useAppSelector((s) => s.pricing.productDrafts);
  const categoryDrafts = useAppSelector((s) => s.pricing.categoryDrafts);

  const [catForOverride, setCatForOverride] = useState<number | undefined>();
  const [catPrice, setCatPrice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const { data: products = [] } = useAllProducts();
  const { data: overrides = EMPTY_OVERRIDES } = useQuery({
    queryKey: ["overrides", companyId],
    queryFn: () => getPriceOverrides(companyId as number),
    enabled: companyId != null,
  });

  const categoryName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const draftCount =
    Object.keys(productDrafts).length + Object.keys(categoryDrafts).length;

  const mergedCategories = useMemo(() => {
    const m: Record<number, number> = { ...overrides.categories };
    for (const [id, val] of Object.entries(categoryDrafts)) {
      const cid = Number(id);
      if (val === null) delete m[cid];
      else m[cid] = val;
    }
    return m;
  }, [overrides.categories, categoryDrafts]);

  const handleSave = async () => {
    if (companyId == null) return;
    setSaving(true);
    try {
      for (const [id, val] of Object.entries(productDrafts)) {
        const refId = Number(id);
        if (val === null)
          await deletePriceOverride({ companyId, scope: "product", refId });
        else
          await setPriceOverride({
            companyId,
            scope: "product",
            refId,
            price: val,
          });
      }
      for (const [id, val] of Object.entries(categoryDrafts)) {
        const refId = Number(id);
        if (val === null)
          await deletePriceOverride({ companyId, scope: "category", refId });
        else
          await setPriceOverride({
            companyId,
            scope: "category",
            refId,
            price: val,
          });
      }
      await queryClient.invalidateQueries({
        queryKey: ["overrides", companyId],
      });
      dispatch(clearDrafts());
      message.success("Персональные цены сохранены");
    } catch {
      message.error("Не удалось сохранить");
    } finally {
      setSaving(false);
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
    {
      title: "Товар",
      render: (_: unknown, p: Product) => (
        <div>
          <div>{p.name}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {categoryName.get(p.categoryId)} · Арт. {p.sku}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Базовая",
      width: 120,
      render: (_: unknown, p: Product) => formatPrice(p.basePrice),
    },
    {
      title: "Персональная",
      width: 160,
      render: (_: unknown, p: Product) => {
        const draft = productDrafts[p.id];
        const value = draft !== undefined ? draft : overrides.products[p.id];
        return (
          <InputNumber
            style={{ width: 130 }}
            min={0}
            step={0.01}
            placeholder="наследуется"
            value={value ?? null}
            onChange={(v) =>
              dispatch(setProductDraft({ productId: p.id, value: v }))
            }
          />
        );
      },
    },
    {
      title: "Итоговая цена",
      width: 200,
      render: (_: unknown, p: Product) => {
        const r = resolvePrice(p, overrides, productDrafts, categoryDrafts);
        return (
          <Space>
            <b>{formatPrice(r.price)}</b>
            {r.source !== "base" && (
              <Tag color={r.source === "product" ? "blue" : "gold"}>
                {r.source === "product" ? "товар" : "категория"}
              </Tag>
            )}
            {r.discountPct !== 0 && (
              <Tag color={r.discountPct > 0 ? "green" : "red"}>
                {r.discountPct > 0
                  ? `-${r.discountPct}%`
                  : `+${-r.discountPct}%`}
              </Tag>
            )}
          </Space>
        );
      },
    },
  ];

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
          Персональные прайсы
        </Typography.Title>
        <Space wrap>
          <Select
            placeholder="Выберите клиента"
            style={{ width: 220 }}
            value={companyId ?? undefined}
            onChange={(v) => dispatch(selectCompany(v ?? null))}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Typography.Text type="secondary">
            Изменено: {draftCount}
          </Typography.Text>
          <Button
            onClick={() => dispatch(clearDrafts())}
            disabled={draftCount === 0}
          >
            Сбросить
          </Button>
          <Button
            type="primary"
            loading={saving}
            disabled={draftCount === 0 || companyId == null}
            onClick={handleSave}
          >
            Сохранить
          </Button>
        </Space>
      </div>

      {companyId == null ? (
        <Empty
          description="Выберите клиента, чтобы настроить персональные цены"
          style={{ padding: 60 }}
        />
      ) : (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Typography.Text strong>Цена по категории:</Typography.Text>
            <Select
              placeholder="Категория"
              style={{ width: 180 }}
              value={catForOverride}
              onChange={setCatForOverride}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <InputNumber
              min={0}
              step={0.01}
              placeholder="Цена"
              value={catPrice}
              onChange={setCatPrice}
            />
            <Button
              disabled={catForOverride == null || catPrice == null}
              onClick={() => {
                if (catForOverride != null && catPrice != null) {
                  dispatch(
                    setCategoryDraft({
                      categoryId: catForOverride,
                      value: catPrice,
                    }),
                  );
                  setCatForOverride(undefined);
                  setCatPrice(null);
                }
              }}
            >
              Задать
            </Button>
          </Space>

          {Object.keys(mergedCategories).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {Object.entries(mergedCategories).map(([id, price]) => (
                <Tag
                  key={id}
                  color="gold"
                  closable
                  onClose={() =>
                    dispatch(
                      setCategoryDraft({ categoryId: Number(id), value: null }),
                    )
                  }
                >
                  {categoryName.get(Number(id))}: {formatPrice(price)}
                </Tag>
              ))}
            </div>
          )}

          <Table
            size="small"
            rowKey="id"
            columns={columns}
            dataSource={products}
            pagination={{ pageSize: 20, showSizeChanger: false }}
          />
        </>
      )}
    </div>
  );
}
