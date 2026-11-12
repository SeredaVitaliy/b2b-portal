import { formatPrice, productImageUrl, unitLabel } from "@/lib/product";
import { clearCart, removeItem, setQuantity } from "@/slices/cartSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { DeleteOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  message,
  Modal,
  Space,
  Tag,
  Typography,
} from "antd";
import { Link, useNavigate } from "react-router-dom";
import QuantityStepper from "@/components/QuantityStepper/QuantityStepper";
import { useEffect, useState } from "react";
import { createOrder } from "@/api/OrderApi";
import { createTemplate } from "@/api/TemplateApi";
import dayjs from "dayjs";
import { Product, resolveBuyerPrice } from "@b2b/shared";
import { getStockSnapshot } from "@/api/StockApi";
import { applyStockUpdate } from "@/slices/stockSlice";
import { useMyOverrides } from "@/hooks/useBuyerPrice";

type Availability =
  | { ok: true }
  | { ok: false; reason: "out" | "short"; stock: number };

function getAvailability(
  product: Product,
  quantity: number,
  liveById: Record<number, { stock: number } | undefined>,
): Availability {
  const stock = liveById[product.id]?.stock ?? product.stock;
  if (stock <= 0) return { ok: false, reason: "out", stock };
  if (quantity > stock) return { ok: false, reason: "short", stock };
  return { ok: true };
}

export default function CartPage() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.cart.items);

  const liveById = useAppSelector((state) => state.stock.byId);

  // Персональные цены компании закупщика: цену позиции и итог считаем по договору
  // (товар > категория > базовая) — тем же resolveBuyerPrice, что и сервер при
  // оформлении, поэтому «Итого» совпадёт с суммой заказа.
  const { data: overrides } = useMyOverrides();
  const ovr = overrides ?? { products: {}, categories: {} };
  const priceOf = (p: Product) =>
    resolveBuyerPrice(
      { id: p.id, categoryId: p.categoryId, basePrice: p.basePrice },
      ovr,
    );

  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce(
    (sum, i) => sum + priceOf(i.product) * i.quantity,
    0,
  );
  const navigate = useNavigate();
  const [isPlacing, setIsPlacing] = useState(false);

  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const [comment, setComment] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<string | null>(null);

  useEffect(() => {
    getStockSnapshot()
      .then((snapshot) => {
        const inCart = new Set(items.map((i) => i.product.id));
        snapshot
          .filter((s) => inCart.has(s.productId))
          .forEach((s) =>
            dispatch(
              applyStockUpdate({
                productId: s.productId,
                stock: s.stock,
                stockStatus: s.stockStatus,
                updatedAt: Date.now(),
              }),
            ),
          );
      })
      .catch(() => {});
  }, []);

  const blockingItems = items.filter(
    (i) => !getAvailability(i.product, i.quantity, liveById).ok,
  );

  const hasBlocking = blockingItems.length > 0;

  if (items.length === 0) {
    return (
      <Empty description="Корзина пуста" style={{ padding: 60 }}>
        <Link to="/catalog">
          <Button type="primary">Перейти в каталог</Button>
        </Link>
      </Empty>
    );
  }

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      message.warning("Введите название шаблона");
      return;
    }
    setIsSavingTemplate(true);
    try {
      await createTemplate(
        name,
        items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
      );
      message.success("Шаблон сохранён");
      setIsTemplateOpen(false);
      setTemplateName("");
    } catch (error) {
      message.error("Не удалось сохранить шаблон");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleRemoveUnavailable = () => {
    blockingItems.forEach((i) => dispatch(removeItem(i.product.id)));
  };

  const handleCheckout = async () => {
    setIsPlacing(true);
    try {
      const order = await createOrder(
        items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        comment.trim() || undefined,
        deliveryDate ?? undefined,
      );
      dispatch(clearCart());
      message.success(`Заказ №${order.id} оформлен`);
      navigate("/orders");
    } catch (error) {
      const serverMessage = (
        error as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      message.error(serverMessage ?? "Не удалось оформить заказ");
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <div>
      <Typography.Title level={2}>Корзина</Typography.Title>

      {hasBlocking && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Некоторые товары недоступны"
          description="Уберите их из корзины или уменьшите количество — иначе заказ не оформить."
          action={
            <Button size="small" onClick={handleRemoveUnavailable}>
              Убрать недоступные
            </Button>
          }
        />
      )}

      <Card>
        {items.map((item) => {
          const { product, quantity } = item;
          const unit = unitLabel[product.unit];
          const imageUrl = productImageUrl(product);
          const av = getAvailability(product, quantity, liveById);

          return (
            <div
              key={product.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "12px 0",
                borderBottom: "1px solid #f0f0f0",
                background: av.ok ? undefined : "fff1f0",
              }}
            >
              <div style={{ width: 56, textAlign: "center" }}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product.name}
                    style={{ maxWidth: 56, maxHeight: 56 }}
                  />
                ) : (
                  <span style={{ fontSize: 28, color: "#16a34a" }}>
                    {product.name.charAt(0)}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/catalog/${product.id}`}>{product.name}</Link>
                <Typography.Text
                  type="secondary"
                  style={{ display: "block", fontSize: 12 }}
                >
                  Арт. {product.sku} · {formatPrice(priceOf(product))} / {unit}
                </Typography.Text>
                {!av.ok && (
                  <Tag color="red" style={{ marginTop: 4 }}>
                    {av.reason === "out"
                      ? "Нет в наличии"
                      : `В наличии только ${av.stock}`}
                  </Tag>
                )}
              </div>
              <QuantityStepper
                value={quantity}
                min={product.minBatch}
                onChange={(q) =>
                  dispatch(setQuantity({ productId: product.id, quantity: q }))
                }
              />
              <Typography.Text
                strong
                style={{ width: 120, textAlign: "right" }}
              >
                {formatPrice(priceOf(product) * quantity)}
              </Typography.Text>

              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => dispatch(removeItem(product.id))}
              />
              <Button onClick={() => setIsTemplateOpen(true)}>
                Сохранить как шаблон
              </Button>
            </div>
          );
        })}
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Typography.Text strong>Комментарий к заказу</Typography.Text>
        <Input.TextArea
          rows={3}
          maxLength={1000}
          placeholder="Например: привезти до обеда, позвонить на складе"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ marginTop: 8, marginBottom: 16 }}
        />
        <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
          Желаемая дата доставки
        </Typography.Text>
        <DatePicker
          value={deliveryDate ? dayjs(deliveryDate) : null}
          onChange={(_, dateString) =>
            setDeliveryDate((dateString as string) || null)
          }
          disabledDate={(current) => current.isBefore(dayjs(), "day")}
          placeholder="Выберите дату"
        />
      </Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 16,
        }}
      >
        <Button onClick={() => dispatch(clearCart())}>Очистить корзину</Button>

        <Space size={24} align="center">
          <Typography.Text type="secondary">
            Позиций: {items.length} · Всего единиц: {totalUnits}
          </Typography.Text>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Итого: {formatPrice(totalPrice)}
          </Typography.Title>
          <Button
            type="primary"
            size="large"
            loading={isPlacing}
            onClick={handleCheckout}
            disabled={hasBlocking}
          >
            Оформить заказ
          </Button>
        </Space>
      </div>
      <Modal
        title="Новый шаблон закупки"
        open={isTemplateOpen}
        onOk={handleSaveTemplate}
        onCancel={() => setIsTemplateOpen(false)}
        confirmLoading={isSavingTemplate}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Input
          placeholder="Например: Еженедельная закупка"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          onPressEnter={handleSaveTemplate}
        />
      </Modal>
    </div>
  );
}
