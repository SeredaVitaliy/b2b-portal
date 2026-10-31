import { getFavorites } from "@/api/FavoritesApi";
import ProductCard from "@/components/ProductCard/ProductCard";
import { Product } from "@b2b/shared";
import { Col, Empty, Row, Spin, Typography } from "antd";
import { useEffect, useState } from "react";

export default function FavoritesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsloading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsloading(true);
      try {
        setProducts(await getFavorites());
      } finally {
        setIsloading(false);
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

  if (products.length === 0) {
    return (
      <Empty description="В избранном пока пусто" style={{ padding: 60 }} />
    );
  }

  return (
    <div>
      <Typography.Title level={2}>Избранное</Typography.Title>
      <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
        {products.map((product) => (
          <Col key={product.id} xs={12} sm={8} md={6} xl={4}>
            <ProductCard product={product} />
          </Col>
        ))}
      </Row>
    </div>
  );
}
