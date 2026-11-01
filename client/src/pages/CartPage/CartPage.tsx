import { formatPrice, productImageUrl, unitLabel } from "@/lib/product";
import { clearCart, removeItem, setQuantity } from "@/slices/cartSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { DeleteOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  message,
  Modal,
  Space,
  Typography,
} from "antd";
import { Link, useNavigate } from "react-router-dom";
import QuantityStepper from "@/components/QuantityStepper/QuantityStepper";
import { useState } from "react";
import { createOrder } from "@/api/OrderApi";
import { createTemplate } from "@/api/TemplateApi";
import dayjs from "dayjs";

export default function CartPage() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.cart.items);
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce(
    (sum, i) => sum + i.product.basePrice * i.quantity,
    0,
  );
  const navigate = useNavigate();
  const [isPlacing, setIsPlacing] = useState(false);

  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const [comment, setComment] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<string | null>(null);

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
      message.error("Не удалось оформить заказ");
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <div>
      <Typography.Title level={2}>Корзина</Typography.Title>
      <Card>
        {items.map((item) => {
          const { product, quantity } = item;
          const unit = unitLabel[product.unit];
          const imageUrl = productImageUrl(product);

          return (
            <div
              key={product.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "12px 0",
                borderBottom: "1px solid #f0f0f0",
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
                  Арт. {product.sku} · {formatPrice(product.basePrice)} / {unit}
                </Typography.Text>
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
                {formatPrice(product.basePrice * quantity)}
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
        {" "}
        {/* ← НОВОЕ, вставляешь это */}
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
