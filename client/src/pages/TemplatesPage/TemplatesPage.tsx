import { deleteTemplate, getTemplates } from "@/api/TemplateApi";
import { useApplyTemplate } from "@/hooks/useApplyTemplate";
import { formatDateTime } from "@/lib/order";
import { OrderTemplate } from "@b2b/shared";
import {
  Button,
  Card,
  Empty,
  message,
  Popconfirm,
  Space,
  Spin,
  Typography,
} from "antd";
import { useEffect, useState } from "react";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<OrderTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const applyTemplate = useApplyTemplate();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        setTemplates(await getTemplates());
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      message.success("Шаблон удалён");
    } catch {
      message.error("Не удалось удалить шаблон");
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (templates.length === 0) {
    return <Empty description="Шаблонов пока нет" style={{ padding: 60 }} />;
  }

  return (
    <div>
      <Typography.Title level={2}>Шаблоны закупок</Typography.Title>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {templates.map((template) => (
          <Card key={template.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div>
                <Typography.Text strong>{template.name}</Typography.Text>
                <Typography.Text
                  type="secondary"
                  style={{ display: "block", fontSize: 12 }}
                >
                  {formatDateTime(template.createdAt)} · позиций:{" "}
                  {template.items.length}
                </Typography.Text>
              </div>
              <Space>
                <Button type="primary" onClick={() => applyTemplate(template)}>
                  Применить
                </Button>
                <Popconfirm
                  title="Удалить шаблон?"
                  onConfirm={() => handleDelete(template.id)}
                  okText="Да"
                  cancelText="Нет"
                >
                  <Button danger>Удалить</Button>
                </Popconfirm>
              </Space>
            </div>
            <div style={{ marginTop: 8 }}>
              {template.items.map((item) => (
                <Typography.Text
                  key={item.productId}
                  type="secondary"
                  style={{ display: "block", fontSize: 13 }}
                >
                  {item.name} — {item.quantity}
                </Typography.Text>
              ))}
            </div>
          </Card>
        ))}
      </Space>
    </div>
  );
}
