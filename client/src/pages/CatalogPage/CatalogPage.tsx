import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Category, Product } from "@b2b/shared";
import {
  Card,
  Checkbox,
  Col,
  Empty,
  Input,
  InputNumber,
  Pagination,
  Row,
  Select,
  Spin,
  Typography,
} from "antd";
import {
  getCategories,
  getProducts,
  type ProductParams,
  type ProductSort,
} from "@/api/ProductApi";
import ProductCard from "@/components/ProductCard/ProductCard";

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

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Состояние каталога живёт в URL (переживает уход на страницу товара и обратно).
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => readParams(searchParams), [searchParams]);

  // id категории → её название (для подбора картинки товара).
  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  // Категории грузим один раз — для выпадающего списка.
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Товары перезагружаем при любом изменении строки запроса.
  useEffect(() => {
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
  }, [searchParams]);

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
    if (next.pageSize && next.pageSize !== 20) sp.set("pageSize", String(next.pageSize));

    setSearchParams(sp);
  };

  return (
    <div>
      <Typography.Title level={2} style={{ marginBottom: 16 }}>
        Каталог
      </Typography.Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Input.Search
            placeholder="Поиск по названию или артикулу"
            allowClear
            defaultValue={params.search}
            onSearch={(value) => update({ search: value || undefined })}
            style={{ width: 280 }}
          />
          <Select
            placeholder="Категория"
            allowClear
            value={params.categoryId}
            onChange={(value?: number) => update({ categoryId: value })}
            style={{ width: 200 }}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <InputNumber
            placeholder="Цена от"
            min={0}
            value={params.minPrice}
            onChange={(value) => update({ minPrice: value ?? undefined })}
            style={{ width: 110 }}
          />
          <InputNumber
            placeholder="Цена до"
            min={0}
            value={params.maxPrice}
            onChange={(value) => update({ maxPrice: value ?? undefined })}
            style={{ width: 110 }}
          />
          <Select
            placeholder="Сортировка"
            allowClear
            value={params.sort}
            onChange={(value?: ProductSort) => update({ sort: value })}
            style={{ width: 190 }}
            options={sortOptions}
          />
          <Checkbox
            checked={!!params.inStock}
            onChange={(e) => update({ inStock: e.target.checked || undefined })}
          >
            Только в наличии
          </Checkbox>
        </div>
      </Card>

      <Typography.Text type="secondary">Найдено товаров: {total}</Typography.Text>

      <Spin spinning={isLoading}>
        {!isLoading && products.length === 0 ? (
          <Empty description="Ничего не найдено" style={{ margin: "48px 0" }} />
        ) : (
          <Row gutter={[16, 16]} style={{ marginTop: 12, minHeight: 200 }}>
            {products.map((product) => (
              <Col key={product.id} xs={12} sm={8} md={6} xl={4}>
                <ProductCard
                  product={product}
                  categoryName={categoryNameById.get(product.categoryId)}
                />
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
        <Pagination
          current={params.page}
          pageSize={params.pageSize}
          total={total}
          onChange={(page, pageSize) => update({ page, pageSize }, false)}
          showSizeChanger
        />
      </div>
    </div>
  );
}
