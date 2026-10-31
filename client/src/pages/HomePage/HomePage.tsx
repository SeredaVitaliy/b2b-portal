import { Link } from "react-router-dom";
import { Button, Card, Col, Descriptions, Row, Tag, Typography } from "antd";
import { ArrowRightOutlined, ShopOutlined } from "@ant-design/icons";
import { useAppSelector } from "@/store/hooks";
import { useEffect, useState } from "react";
import { Product } from "@b2b/shared";
import { getFrequentlyOrdered } from "@/api/OrderApi";
import ProductCard from "@/components/ProductCard/ProductCard";

const roleLabel: Record<string, string> = {
  buyer: "Закупщик",
  manager: "Менеджер",
  admin: "Администратор",
};

export default function HomePage() {
  const user = useAppSelector((state) => state.auth.user);
  const [frequent, setFrequent] = useState<Product[]>([]);

  useEffect(() => {
    getFrequentlyOrdered()
      .then(setFrequent)
      .catch(() => {});
  }, []);

  return (
    <div>
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Здравствуйте, {user?.name}!
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ fontSize: 16 }}>
        Добро пожаловать в B2B Портал — оптовые поставки продуктов.
      </Typography.Paragraph>
      {frequent.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            Часто заказываете
          </Typography.Title>
          <div
            style={{
              display: "flex",
              gap: 12,
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            {frequent.map((product) => (
              <div key={product.id} style={{ flex: "0 0 180px" }}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </Card>
      )}
      <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
        <Col xs={24} md={14}>
          <Card>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              <ShopOutlined style={{ color: "#16a34a", marginRight: 8 }} />
              Каталог товаров
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              Более 300 позиций: бакалея, молочное, мясо, овощи, напитки и
              бытовая химия. Поиск, фильтры по категории и цене, сортировка и
              постраничный просмотр.
            </Typography.Paragraph>
            <Link to="/catalog">
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                iconPosition="end"
              >
                Перейти в каталог
              </Button>
            </Link>
          </Card>
        </Col>

        <Col xs={24} md={10}>
          <Card title="Ваш профиль">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Имя">{user?.name}</Descriptions.Item>
              <Descriptions.Item label="Email">{user?.email}</Descriptions.Item>
              <Descriptions.Item label="Роль">
                <Tag color="green">
                  {user ? (roleLabel[user.role] ?? user.role) : ""}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
