import { useState, type MouseEvent } from "react";
import { Button, Card, Space, Tag, Typography } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import type { Product } from "@b2b/shared";
import {
  formatPrice,
  productImageUrl,
  stockMeta,
  unitLabel,
} from "@/lib/product";
import { Link } from "react-router-dom";
import { addItem, removeItem, setQuantity } from "@/slices/cartSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import QuantityStepper from "@/components/QuantityStepper/QuantityStepper";

interface Props {
  product: Product;
  categoryName?: string;
}

export default function ProductCard({ product, categoryName }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const stock = stockMeta[product.stockStatus];
  const unit = unitLabel[product.unit];
  const imageUrl = productImageUrl(product, categoryName);
  const showImage = imageUrl && !imageFailed;
  const dispatch = useAppDispatch();
  const cartItem = useAppSelector((state) =>
    state.cart.items.find((i) => i.product.id === product.id),
  );

  const stopNav = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const cover = showImage ? (
    <div
      style={{
        height: 130,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        padding: 10,
      }}
    >
      <img
        src={imageUrl}
        alt={product.name}
        onError={() => setImageFailed(true)}
        style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
      />
    </div>
  ) : (
    <div
      style={{
        height: 130,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#f6ffed,#dcfce7)",
        color: "#16a34a",
        fontSize: 44,
        fontWeight: 700,
      }}
    >
      {product.name.charAt(0)}
    </div>
  );

  return (
    <Link
      to={`/catalog/${product.id}`}
      style={{ display: "block", height: "100%", color: "inherit" }}
    >
      <Card
        hoverable
        size="small"
        styles={{ body: { padding: 14 } }}
        style={{ height: "100%" }}
        cover={cover}
      >
        <Space direction="vertical" size={6} style={{ width: "100%" }}>
          <Tag color={stock.color} style={{ marginInlineEnd: 0 }}>
            {stock.label}
          </Tag>
          <Typography.Text strong ellipsis={{ tooltip: product.name }}>
            {product.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Арт. {product.sku}
          </Typography.Text>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {formatPrice(product.basePrice)}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            за {unit} · партия от {product.minBatch} {unit}
          </Typography.Text>

          <div onClick={stopNav}>
            {product.stockStatus === "out" ? (
              <Button block disabled>
                Нет в наличии
              </Button>
            ) : cartItem ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <QuantityStepper
                  value={cartItem.quantity}
                  min={product.minBatch}
                  onChange={(q) =>
                    dispatch(
                      setQuantity({ productId: product.id, quantity: q }),
                    )
                  }
                />
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => dispatch(removeItem(product.id))}
                />
              </div>
            ) : (
              <Button
                type="primary"
                block
                onClick={() =>
                  dispatch(addItem({ product, quantity: product.minBatch }))
                }
              >
                В корзину
              </Button>
            )}
          </div>
        </Space>
      </Card>
    </Link>
  );
}
