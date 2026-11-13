import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Category, Product } from "@b2b/shared";
import {
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  InputNumber,
  Pagination,
  Row,
  Select,
  Spin,
  Typography,
} from "antd";
import { FixedSizeGrid, type GridChildComponentProps } from "react-window";
import {
  getCategories,
  getProducts,
  type ProductParams,
  type ProductSort,
} from "@/api/ProductApi";
import ProductCard from "@/components/ProductCard/ProductCard";
import { useElementSize } from "@/hooks/useElementSize";

const sortOptions = [
  { value: "popularity", label: "По популярности" },
  { value: "price_asc", label: "Сначала дешёвые" },
  { value: "price_desc", label: "Сначала дорогие" },
  { value: "name_asc", label: "Название А–Я" },
  { value: "name_desc", label: "Название Я–А" },
];

// Собираем объект параметров из строки запроса (?page=2&categoryId=3&...).
function readParams(sp: URLSearchParams): ProductParams {
  const num = (key: string) => {
    const v = sp.get(key);
    return v ? Number(v) : undefined;
  };
  return {
    search: sp.get("search") || undefined,
    categoryId: num("categoryId"),
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    inStock: sp.get("inStock") === "true" || undefined,
    sort: (sp.get("sort") as ProductSort | null) || undefined,
    page: num("page") ?? 1,
    pageSize: num("pageSize") ?? 20,
  };
}

// --- Виртуализированный режим «все товары списком» ---
const MIN_COLUMN_WIDTH = 220;
const ROW_HEIGHT = 360;

interface CellData {
  products: Product[];
  columnCount: number;
  categoryNameById: Map<number, string>;
}

function Cell({
  columnIndex,
  rowIndex,
  style,
  data,
}: GridChildComponentProps<CellData>) {
  const { products, columnCount, categoryNameById } = data;
  const index = rowIndex * columnCount + columnIndex;
  if (index >= products.length) return null;
  const product = products[index];
  return (
    <div style={{ ...style, padding: 8 }}>
      <ProductCard
        product={product}
        categoryName={categoryNameById.get(product.categoryId)}
      />
    </div>
  );
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Состояние каталога живёт в URL (переживает уход на страницу товара и обратно).
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => readParams(searchParams), [searchParams]);

  // Режим «все товары списком» (виртуализированная сетка вместо пагинации).
  const [showAll, setShowAll] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const { ref, width, height } = useElementSize<HTMLDivElement>();

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Постраничный режим: грузим одну страницу при изменении фильтров/страницы.
  useEffect(() => {
    if (showAll) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await getProducts(params);
        setProducts(data.items);
        setTotal(data.total);
      } catch {
        // ошибку уже залогировали в ProductApi
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, showAll]);

  // Режим «все списком»: один запрос на весь отфильтрованный каталог (без страниц).
  useEffect(() => {
    if (!showAll) return;
    const load = async () => {
      setAllLoading(true);
      try {
        const data = await getProducts({ ...params, page: 1, pageSize: 2000 });
        setAllProducts(data.items);
        setTotal(data.total);
      } catch {
        // ошибку уже залогировали в ProductApi
      } finally {
        setAllLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, showAll]);

  // Любое изменение фильтров/страницы записываем в URL.
  const update = (changes: Partial<ProductParams>, resetPage = true) => {
    const next: ProductParams = { ...params, ...changes };
    if (resetPage) next.page = 1;

    const sp = new URLSearchParams();
    if (next.search) sp.set("search", next.search);
    if (next.categoryId != null) sp.set("categoryId", String(next.categoryId));
    if (next.minPrice != null) sp.set("minPrice", String(next.minPrice));
    if (next.maxPrice != null) sp.set("maxPrice", String(next.maxPrice));
    if (next.inStock) sp.set("inStock", "true");
    if (next.sort) sp.set("sort", next.sort);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    if (next.pageSize && next.pageSize !== 20)
      sp.set("pageSize", String(next.pageSize));

    setSearchParams(sp);
  };

  const activeCat = params.categoryId;
  const columnCount = Math.max(1, Math.floor(width / MIN_COLUMN_WIDTH));
  const columnWidth = width > 0 ? Math.floor(width / columnCount) : 0;
  const rowCount = Math.ceil(allProducts.length / columnCount);

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <Link to="/">Главная</Link> },
          { title: "Каталог" },
          ...(activeCat
            ? [{ title: categoryNameById.get(activeCat) ?? "Категория" }]
            : []),
        ]}
      />

      <Row gutter={24}>
        {/* Сайдбар с фильтрами */}
        <Col xs={24} md={7} lg={6} xl={5}>
          <Card size="small" title="Фильтры" style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              Категории
            </Typography.Text>
            <div
              style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}
            >
              <Button
                type={activeCat == null ? "primary" : "text"}
                size="small"
                block
                style={{ textAlign: "left", marginBottom: 4 }}
                onClick={() => update({ categoryId: undefined })}
              >
                Все категории
              </Button>
              {categories.map((c) => (
                <Button
                  key={c.id}
                  type={activeCat === c.id ? "primary" : "text"}
                  size="small"
                  block
                  style={{ textAlign: "left", marginBottom: 4 }}
                  onClick={() => update({ categoryId: c.id })}
                >
                  {c.name}
                </Button>
              ))}
            </div>

            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              Цена, ₽
            </Typography.Text>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <InputNumber
                placeholder="от"
                min={0}
                value={params.minPrice}
                onChange={(v) => update({ minPrice: v ?? undefined })}
                style={{ width: "100%" }}
              />
              <InputNumber
                placeholder="до"
                min={0}
                value={params.maxPrice}
                onChange={(v) => update({ maxPrice: v ?? undefined })}
                style={{ width: "100%" }}
              />
            </div>

            <Checkbox
              checked={!!params.inStock}
              onChange={(e) => update({ inStock: e.target.checked || undefined })}
            >
              Только в наличии
            </Checkbox>
          </Card>
        </Col>

        {/* Основная область */}
        <Col xs={24} md={17} lg={18} xl={19}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <Typography.Text type="secondary">
              Найдено товаров: {total}
            </Typography.Text>
            <Select
              placeholder="Сортировка"
              allowClear
              value={params.sort}
              onChange={(value?: ProductSort) => update({ sort: value })}
              style={{ width: 200 }}
              options={sortOptions}
            />
          </div>

          {showAll ? (
            <Spin spinning={allLoading}>
              <div ref={ref} style={{ height: "calc(100vh - 280px)" }}>
                {width > 0 && allProducts.length > 0 && (
                  <FixedSizeGrid
                    columnCount={columnCount}
                    columnWidth={columnWidth}
                    rowCount={rowCount}
                    rowHeight={ROW_HEIGHT}
                    width={width}
                    height={height}
                    itemData={{
                      products: allProducts,
                      columnCount,
                      categoryNameById,
                    }}
                  >
                    {Cell}
                  </FixedSizeGrid>
                )}
                {!allLoading && allProducts.length === 0 && (
                  <Empty
                    description="Ничего не найдено"
                    style={{ margin: "48px 0" }}
                  />
                )}
              </div>
            </Spin>
          ) : (
            <>
              <Spin spinning={isLoading}>
                {!isLoading && products.length === 0 ? (
                  <Empty
                    description="Ничего не найдено"
                    style={{ margin: "48px 0" }}
                  />
                ) : (
                  <Row gutter={[16, 16]} style={{ minHeight: 200 }}>
                    {products.map((product) => (
                      <Col key={product.id} xs={12} sm={8} lg={8} xl={6}>
                        <ProductCard
                          product={product}
                          categoryName={categoryNameById.get(product.categoryId)}
                          highlight={params.search}
                        />
                      </Col>
                    ))}
                  </Row>
                )}
              </Spin>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 24,
                }}
              >
                <Pagination
                  current={params.page}
                  pageSize={params.pageSize}
                  total={total}
                  onChange={(page, pageSize) => update({ page, pageSize }, false)}
                  showSizeChanger
                />
              </div>
            </>
          )}

          {/* Под пагинацией — переключатель на полный список (виртуализация). */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 16,
            }}
          >
            <Checkbox
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            >
              Показать все товары списком
            </Checkbox>
          </div>
        </Col>
      </Row>
    </div>
  );
}
