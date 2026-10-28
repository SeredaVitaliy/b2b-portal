import { formatPrice, productImageUrl, unitLabel } from "@/lib/product";
import { clearCart, removeItem, setQuantity } from "@/slices/cartSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { DeleteOutlined } from "@ant-design/icons";
import { Button, Card, Empty, message, Space, Typography } from "antd";
import { Link } from "react-router-dom";
import QuantityStepper from "@/components/QuantityStepper/QuantityStepper";

export default function CartPage() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.cart.items);
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce(
    (sum, i) => sum + i.product.basePrice * i.quantity,
    0,
  );

  if (items.length === 0) {
    return (
      <Empty description="Корзина пуста" style={{ padding: 60 }}>
        <Link to="/catalog">
          <Button type="primary">Перейти в каталог</Button>
        </Link>
      </Empty>
    );
  }

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
            </div>
          );
        })}
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
            onClick={() => message.info("Оформление заказа — следующая фича")}
          >
            Оформить заказ
          </Button>
        </Space>
      </div>
    </div>
  );
}
