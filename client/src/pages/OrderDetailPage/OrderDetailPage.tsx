import { getOrder } from "@/api/OrderApi";
import { formatDateTime, orderStatusMeta } from "@/lib/order";
import { formatPrice, unitLabel } from "@/lib/product";
import { Order } from "@b2b/shared";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Spin, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        setOrder(await getOrder(Number(id)));
      } catch {
        setOrder(null);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!order) {
    return (
      <Empty description="Заказ не найден" style={{ padding: 60 }}>
        <Link to="/orders">
          <Button type="primary">К списку заказов</Button>
        </Link>
      </Empty>
    );
  }

  const status = orderStatusMeta[order.status];

  return (
    <div>
      <Link to="/orders">
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          style={{ paddingLeft: 0 }}
        >
          Назад к заказам
        </Button>
      </Link>

      <div
        style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}
      >
        <Typography.Title level={2} style={{ margin: 0 }}>
          Заказ №{order.id}
        </Typography.Title>
        <Tag color={status.color}>{status.label}</Tag>
      </div>
      <Typography.Text type="secondary">
        {formatDateTime(order.createdAt)}
      </Typography.Text>

      <Card style={{ marginTop: 16 }}>
        {order.items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "12px 0",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link to={`/catalog/${item.productId}`}>{item.name}</Link>
              <Typography.Text
                type="secondary"
                style={{ display: "block", fontSize: 12 }}
              >
                Арт. {item.sku} · {formatPrice(item.unitPrice)} /{" "}
                {unitLabel[item.unit]}
              </Typography.Text>
            </div>
            <Typography.Text>
              {item.quantity} {unitLabel[item.unit]}
            </Typography.Text>
            <Typography.Text strong style={{ width: 120, textAlign: "right" }}>
              {formatPrice(item.unitPrice * item.quantity)}
            </Typography.Text>
          </div>
        ))}
      </Card>

      <div style={{ textAlign: "right", marginTop: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Итого: {formatPrice(order.total)}
        </Typography.Title>
      </div>
    </div>
  );
}
