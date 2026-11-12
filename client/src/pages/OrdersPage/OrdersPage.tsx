import { cancelOrder, getOrders } from "@/api/OrderApi";
import { useRepeatOrder } from "@/hooks/useRepeatOrder";
import SaveAsTemplateButton from "@/components/SaveAsTemplateButton/SaveAsTemplateButton";
import { formatDateTime, orderStatusMeta } from "@/lib/order";
import { formatPrice } from "@/lib/product";
import { Order } from "@b2b/shared";
import {
  Button,
  Card,
  DatePicker,
  Empty,
  message,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const repeatOrder = useRepeatOrder();

  const handleCancel = async (order: Order) => {
    try {
      const updated = await cancelOrder(order.id);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      message.success("Заказ отменён");
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response
        ?.data?.message;
      message.error(msg ?? "Не удалось отменить заказ");
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const activeStatus = searchParams.get("status") ?? "all";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const visibleOrders = orders.filter((order) => {
    const byStatus = activeStatus === "all" || order.status === activeStatus;
    const byPeriod =
      !from ||
      !to ||
      (!dayjs.unix(order.createdAt).isBefore(from, "day") &&
        !dayjs.unix(order.createdAt).isAfter(to, "day"));
    return byStatus && byPeriod;
  });

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
      <Select
        value={activeStatus}
        style={{ width: 200, marginBottom: 16 }}
        onChange={(value) => {
          const next = new URLSearchParams(searchParams);
          if (value === "all") next.delete("status");
          else next.set("status", value);
          setSearchParams(next);
        }}
        options={[
          { value: "all", label: "Все статусы" },
          ...Object.entries(orderStatusMeta).map(([value, meta]) => ({
            value,
            label: meta.label,
          })),
        ]}
      />
      <DatePicker.RangePicker
        value={from && to ? [dayjs(from), dayjs(to)] : null}
        style={{ marginBottom: 16, marginLeft: 8 }}
        onChange={(_, dateStrings) => {
          const next = new URLSearchParams(searchParams);
          if (dateStrings && dateStrings[0] && dateStrings[1]) {
            next.set("from", dateStrings[0]);
            next.set("to", dateStrings[1]);
          } else {
            next.delete("from");
            next.delete("to");
          }
          setSearchParams(next);
        }}
      />
      {visibleOrders.length === 0 ? (
        <Empty description="Нет заказов с таким статусом" />
      ) : (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {visibleOrders.map((order) => {
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
                      <Typography.Text strong>
                        Заказ №{order.id}
                      </Typography.Text>
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
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        repeatOrder(order);
                      }}
                    >
                      Повторить
                    </Button>
                    <SaveAsTemplateButton
                      size="small"
                      stopPropagation
                      defaultName={`Заказ №${order.id}`}
                      items={order.items.map((i) => ({
                        productId: i.productId,
                        quantity: i.quantity,
                      }))}
                    />
                    {order.status === "new" && (
                      <Popconfirm
                        title="Отменить заказ?"
                        okText="Да"
                        cancelText="Нет"
                        onConfirm={() => handleCancel(order)}
                      >
                        <Button
                          size="small"
                          danger
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          Отменить
                        </Button>
                      </Popconfirm>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </Space>
      )}
    </div>
  );
}
