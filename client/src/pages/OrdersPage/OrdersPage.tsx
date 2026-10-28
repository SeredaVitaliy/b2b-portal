import { getOrders } from "@/api/OrderApi";
import { formatDateTime, orderStatusMeta } from "@/lib/order";
import { formatPrice } from "@/lib/product";
import { Order } from "@b2b/shared";
import { Card, Empty, Space, Spin, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        setOrders(await getOrders());
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (orders.length === 0) {
    return <Empty description="Заказов пока нет" style={{ padding: 60 }} />;
  }

  return (
    <div>
      <Typography.Title level={2}>Мои заказы</Typography.Title>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {orders.map((order) => {
          const status = orderStatusMeta[order.status];
          return (
            <Link key={order.id} to={`/orders/${order.id}`}>
              <Card hoverable>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div>
                    <Typography.Text strong>Заказ №{order.id}</Typography.Text>
                    <Typography.Text
                      type="secondary"
                      style={{ display: "block", fontSize: 12 }}
                    >
                      {formatDateTime(order.createdAt)} · позиций:{" "}
                      {order.items.length}
                    </Typography.Text>
                  </div>
                  <Tag color={status.color}>{status.label}</Tag>
                  <Typography.Text strong>
                    {formatPrice(order.total)}
                  </Typography.Text>
                </div>
              </Card>
            </Link>
          );
        })}
      </Space>
    </div>
  );
}
