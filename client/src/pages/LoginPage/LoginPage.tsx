import { Card, Typography } from "antd";
import { ShopOutlined } from "@ant-design/icons";
import LoginForm from "@/components/LoginForm/LoginForm";

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
        padding: 16,
      }}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 34, color: "#16a34a", lineHeight: 1 }}>
            <ShopOutlined />
          </div>
          <Typography.Title level={3} style={{ margin: "10px 0 2px" }}>
            B2B Портал
          </Typography.Title>
          <Typography.Text type="secondary">Вход в личный кабинет</Typography.Text>
        </div>

        <LoginForm />

        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, textAlign: "center", marginTop: 16, marginBottom: 0 }}
        >
          Демо-доступ: buyer@b2b.dev / buyer123
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
