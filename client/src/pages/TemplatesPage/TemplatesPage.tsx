import { deleteTemplate, getTemplates } from "@/api/TemplateApi";
import { useApplyTemplate } from "@/hooks/useApplyTemplate";
import TemplateConstructor from "@/components/TemplateConstructor/TemplateConstructor";
import { formatDateTime } from "@/lib/order";
import { OrderTemplate } from "@b2b/shared";
import { PlusOutlined } from "@ant-design/icons";
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
  const [isConstructorOpen, setIsConstructorOpen] = useState(false);
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

  // Конструктор вернул готовый шаблон — показываем сверху без повторного запроса.
  const handleCreated = (template: OrderTemplate) => {
    setTemplates((prev) => [template, ...prev]);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Typography.Title level={2} style={{ margin: 0 }}>
          Шаблоны закупок
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsConstructorOpen(true)}
        >
          Создать шаблон
        </Button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : templates.length === 0 ? (
        <Empty
          description="Шаблонов пока нет — создайте первый с нуля или сохраните заказ как шаблон"
          style={{ padding: 60 }}
        />
      ) : (
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
                  <Button
                    type="primary"
                    onClick={() => applyTemplate(template)}
                  >
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
      )}

      <TemplateConstructor
        open={isConstructorOpen}
        onClose={() => setIsConstructorOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
