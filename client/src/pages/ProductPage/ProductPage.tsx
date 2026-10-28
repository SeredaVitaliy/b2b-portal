import { getProduct } from "@/api/ProductApi";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Product } from "@b2b/shared";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  message,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  formatPrice,
  productImageUrl,
  stockMeta,
  unitLabel,
} from "@/lib/product";

import { useAppDispatch } from "@/store/hooks";
import { addItem } from "@/slices/cartSlice";
import QuantityStepper from "@/components/QuantityStepper/QuantityStepper";

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (product) setQuantity(product.minBatch);
  }, [product]);

  const handleAddToCart = () => {
    if (!product) return;
    dispatch(addItem({ product, quantity }));
    message.success(
      `Добавлено: ${product.name} × ${quantity} ${unitLabel[product.unit]}`,
    );
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        setProduct(await getProduct(Number(id)));
      } catch {
        setProduct(null);
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

  if (!product) {
    return (
      <Empty description="Товар не найден" style={{ padding: 60 }}>
        <Link to="/catalog">
          <Button type="primary">Вернуться в каталог</Button>
        </Link>
      </Empty>
    );
  }

  const stock = stockMeta[product.stockStatus];
  const unit = unitLabel[product.unit];
  const imageUrl = productImageUrl(product);

  return (
    <div>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ paddingLeft: 0 }}
      >
        Назад в каталог
      </Button>

      <Row gutter={[24, 24]} style={{ marginTop: 8 }}>
        <Col xs={24} md={10}>
          <Card>
            <div
              style={{
                height: 280,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.name}
                  style={{
                    maxHeight: "100%",
                    maxWidth: "100%",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <span style={{ fontSize: 80, color: "#16a34a" }}>
                  {product.name.charAt(0)}
                </span>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={14}>
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Tag color={stock.color}>{stock.label}</Tag>
            <Typography.Title level={2} style={{ margin: 0 }}>
              {product.name}
            </Typography.Title>
            <Typography.Text type="secondary">
              Артикул: {product.sku}
            </Typography.Text>
            <Typography.Title level={2} style={{ margin: 0, color: "#16a34a" }}>
              {formatPrice(product.basePrice)}
            </Typography.Title>
            {product.stockStatus === "out" ? (
              <Typography.Text type="danger">Нет в наличии</Typography.Text>
            ) : (
              <Space>
                <QuantityStepper
                  value={quantity}
                  min={product.minBatch}
                  onChange={setQuantity}
                />

                <Button type="primary" size="large" onClick={handleAddToCart}>
                  В корзину
                </Button>
              </Space>
            )}
            <Typography.Paragraph>{product.description}</Typography.Paragraph>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Единица">{unit}</Descriptions.Item>
              <Descriptions.Item label="Минимальная партия">
                {product.minBatch} {unit}
              </Descriptions.Item>
              <Descriptions.Item label="Остаток на складе">
                {product.stock} {unit}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        </Col>
      </Row>
    </div>
  );
}
