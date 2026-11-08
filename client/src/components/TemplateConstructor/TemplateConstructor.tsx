import { getProducts } from "@/api/ProductApi";
import { createTemplate } from "@/api/TemplateApi";
import { formatPrice, unitLabel } from "@/lib/product";
import { OrderTemplate, Product } from "@b2b/shared";
import {
  Button,
  Empty,
  Input,
  InputNumber,
  List,
  Modal,
  Space,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";

// Одна выбранная позиция будущего шаблона: держим весь товар (для минпартии,
// шага, единицы и отображения) + заданное количество.
interface Line {
  product: Product;
  quantity: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  // Созданный шаблон отдаём наверх, чтобы страница показала его без перезапроса.
  onCreated: (template: OrderTemplate) => void;
}

// Конструктор шаблона «с нуля»: имя + поиск по каталогу + выбор товаров с
// количеством. Собираем позиции на клиенте и отправляем готовым createTemplate
// (тем же, что и сохранение из корзины/заказа) — бэкенд не трогаем.
export default function TemplateConstructor({
  open,
  onClose,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Каждое открытие — чистая форма.
  useEffect(() => {
    if (open) {
      setName("");
      setSearch("");
      setResults([]);
      setLines([]);
    }
  }, [open]);

  // Поиск с debounce: ждём 300 мс после последнего ввода и шлём один запрос,
  // а не на каждую букву. Пустой запрос ничего не ищет.
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const page = await getProducts({ search: q, pageSize: 20 });
        setResults(page.items);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const selectedIds = useMemo(
    () => new Set(lines.map((l) => l.product.id)),
    [lines],
  );

  const addProduct = (product: Product) => {
    if (selectedIds.has(product.id)) return;
    setLines((prev) => [...prev, { product, quantity: product.minBatch }]);
  };

  const setQty = (id: number, quantity: number) => {
    setLines((prev) =>
      prev.map((l) => (l.product.id === id ? { ...l, quantity } : l)),
    );
  };

  const removeLine = (id: number) => {
    setLines((prev) => prev.filter((l) => l.product.id !== id));
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      message.warning("Введите название шаблона");
      return;
    }
    if (lines.length === 0) {
      message.warning("Добавьте хотя бы один товар");
      return;
    }
    setIsSaving(true);
    try {
      const template = await createTemplate(
        trimmed,
        lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      );
      message.success("Шаблон создан");
      onCreated(template);
      onClose();
    } catch {
      message.error("Не удалось создать шаблон");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title="Новый шаблон с нуля"
      open={open}
      onOk={handleSave}
      onCancel={onClose}
      confirmLoading={isSaving}
      okText="Создать шаблон"
      cancelText="Отмена"
      width={640}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Input
          placeholder="Название шаблона — например: Еженедельная закупка"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div>
          <Typography.Text strong>Добавить товары</Typography.Text>
          <Input.Search
            placeholder="Поиск по каталогу: название или артикул"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            loading={isSearching}
            allowClear
            style={{ marginTop: 8 }}
          />
          {search.trim() && (
            <List
              size="small"
              bordered
              style={{ marginTop: 8, maxHeight: 220, overflowY: "auto" }}
              dataSource={results}
              locale={{
                emptyText: isSearching ? "Ищем…" : "Ничего не найдено",
              }}
              renderItem={(product) => (
                <List.Item
                  actions={[
                    <Button
                      key="add"
                      size="small"
                      type="link"
                      disabled={selectedIds.has(product.id)}
                      onClick={() => addProduct(product)}
                    >
                      {selectedIds.has(product.id) ? "Добавлен" : "Добавить"}
                    </Button>,
                  ]}
                >
                  <div style={{ minWidth: 0 }}>
                    <Typography.Text ellipsis style={{ display: "block" }}>
                      {product.name}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Арт. {product.sku} · {formatPrice(product.basePrice)} /{" "}
                      {unitLabel[product.unit]}
                    </Typography.Text>
                  </div>
                </List.Item>
              )}
            />
          )}
        </div>

        <div>
          <Typography.Text strong>
            Позиции шаблона{lines.length > 0 ? ` (${lines.length})` : ""}
          </Typography.Text>
          {lines.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Пока ничего не добавлено"
              style={{ margin: "8px 0" }}
            />
          ) : (
            <Space
              direction="vertical"
              size={8}
              style={{ width: "100%", marginTop: 8 }}
            >
              {lines.map((line) => (
                <div
                  key={line.product.id}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text ellipsis style={{ display: "block" }}>
                      {line.product.name}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      мин. партия {line.product.minBatch}{" "}
                      {unitLabel[line.product.unit]}
                    </Typography.Text>
                  </div>
                  <InputNumber
                    min={line.product.minBatch}
                    step={line.product.step}
                    value={line.quantity}
                    onChange={(v) =>
                      setQty(
                        line.product.id,
                        Math.max(
                          line.product.minBatch,
                          Number(v) || line.product.minBatch,
                        ),
                      )
                    }
                    style={{ width: 110 }}
                  />
                  <Button
                    danger
                    size="small"
                    onClick={() => removeLine(line.product.id)}
                  >
                    Убрать
                  </Button>
                </div>
              ))}
            </Space>
          )}
        </div>
      </Space>
    </Modal>
  );
}
