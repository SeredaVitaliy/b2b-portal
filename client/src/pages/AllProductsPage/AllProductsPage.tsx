import { useEffect, useState } from "react";
import { Spin, Typography } from "antd";
import { FixedSizeGrid, type GridChildComponentProps } from "react-window";
import type { Product } from "@b2b/shared";
import { getProducts } from "@/api/ProductApi";
import ProductCard from "@/components/ProductCard/ProductCard";
import { useElementSize } from "@/hooks/useElementSize";

// Целевая ширина карточки. Реальную ширину колонки подгоним под контейнер.
const MIN_COLUMN_WIDTH = 240;
// Высота строки = высота карточки (~340) + вертикальный зазор.
const ROW_HEIGHT = 360;
// Зазор между карточками — внутренний отступ ячейки.
const GUTTER = 16;

// Данные, которые сетка прокидывает в каждую ячейку через itemData.
interface CellData {
  products: Product[];
  columnCount: number;
}

// Рендер ОДНОЙ ячейки. react-window зовёт это только для видимых.
function Cell({
  columnIndex,
  rowIndex,
  style,
  data,
}: GridChildComponentProps<CellData>) {
  const { products, columnCount } = data;
  // 2D-координаты ячейки → плоский индекс в массиве товаров.
  const index = rowIndex * columnCount + columnIndex;
  // Последняя строка почти всегда неполная — хвостовые ячейки пустые.
  if (index >= products.length) return null;
  const product = products[index];

  // style ОБЯЗАТЕЛЬНО на внешний div: это absolute-позиционирование от react-window.
  return (
    <div style={{ ...style, padding: GUTTER / 2 }}>
      <ProductCard product={product} />
    </div>
  );
}

export default function AllProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { ref, width, height } = useElementSize<HTMLDivElement>();

  // Грузим ВЕСЬ каталог одним запросом (бэк под это открыт: потолок pageSize 2000).
  useEffect(() => {
    getProducts({ pageSize: 2000 })
      .then((data) => setProducts(data.items))
      .catch(() => {
        // ошибку уже залогировали в ProductApi
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Сколько колонок влезает по ширине — отсюда «отзывчивость» без Col-брейкпоинтов.
  const columnCount = Math.max(1, Math.floor(width / MIN_COLUMN_WIDTH));
  // Растягиваем колонки, чтобы заполнить всю ширину ровно.
  const columnWidth = Math.floor(width / columnCount);
  const rowCount = Math.ceil(products.length / columnCount);

  return (
    <div>
      <Typography.Title level={2} style={{ marginBottom: 8 }}>
        Все товары
      </Typography.Title>
      <Typography.Text type="secondary">
        Всего: {products.length}
      </Typography.Text>

      <Spin spinning={isLoading}>
        {/* Бокс фиксированной высоты: внутри него виртуальная сетка со СВОИМ скроллом.
            useElementSize замеряет этот бокс и отдаёт сетке точные width/height. */}
        <div ref={ref} style={{ height: "calc(100vh - 220px)", marginTop: 12 }}>
          {width > 0 && (
            <FixedSizeGrid
              columnCount={columnCount}
              columnWidth={columnWidth}
              rowCount={rowCount}
              rowHeight={ROW_HEIGHT}
              width={width}
              height={height}
              itemData={{ products, columnCount } satisfies CellData}
            >
              {Cell}
            </FixedSizeGrid>
          )}
        </div>
      </Spin>
    </div>
  );
}
