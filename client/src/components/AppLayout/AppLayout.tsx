import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button,
  Divider,
  Layout,
  Menu,
  Popover,
  Space,
  Typography,
} from "antd";
import { formatPrice } from "@/lib/product";
import {
  LogoutOutlined,
  ShopOutlined,
  UserOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { logout } from "@/api/AuthApi";
import { tokenManager } from "@/api/tokenStorage";
import { clearUser } from "@/slices/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useEffect } from "react";
import { getFavorites } from "@/api/FavoritesApi";
import { setFavorites } from "@/slices/favoritesSlice";

const { Header, Content, Footer } = Layout;

export default function AppLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);
  const cartCount = useAppSelector((state) => state.cart.items.length);
  const cartItems = useAppSelector((state) => state.cart.items);
  const cartTotal = cartItems.reduce(
    (sum, i) => sum + i.product.basePrice * i.quantity,
    0,
  );

  useEffect(() => {
    getFavorites()
      .then((products) => dispatch(setFavorites(products.map((p) => p.id))))
      .catch(() => {});
  }, [dispatch]);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
    } finally {
      tokenManager.clearAccessToken();
      localStorage.removeItem("refreshToken");
      dispatch(clearUser());
      navigate("/login");
    }
  };

  const menuItems = [
    { key: "/", label: <Link to="/">Главная</Link> },
    { key: "/catalog", label: <Link to="/catalog">Каталог</Link> },
    { key: "/orders", label: <Link to="/orders">Мои заказы</Link> },
    { key: "/favorites", label: <Link to="/favorites">Избранное</Link> },
  ];

  // Какой пункт меню подсветить: по началу пути (чтобы /catalog/5 и /orders/3 тоже подсвечивались).
  const activeKey = location.pathname.startsWith("/catalog")
    ? "/catalog"
    : location.pathname.startsWith("/orders")
      ? "/orders"
      : location.pathname.startsWith("/favorites")
        ? "/favorites"
        : "/";

  const cartPreview = (
    <div style={{ width: 280 }}>
      {cartItems.length === 0 ? (
        <Typography.Text type="secondary">Корзина пуста</Typography.Text>
      ) : (
        <>
          {cartItems.map((i) => (
            <div
              key={i.product.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "4px 0",
              }}
            >
              <Typography.Text ellipsis style={{ maxWidth: 150 }}>
                {i.product.name}
              </Typography.Text>
              <Typography.Text type="secondary">
                {i.quantity} × {formatPrice(i.product.basePrice)}
              </Typography.Text>
            </div>
          ))}
          <Divider style={{ margin: "8px 0" }} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 600,
            }}
          >
            <span>Итого</span>
            <span>{formatPrice(cartTotal)}</span>
          </div>
          <Link to="/cart">
            <Button type="primary" block style={{ marginTop: 8 }}>
              Перейти в корзину
            </Button>
          </Link>
        </>
      )}
    </div>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          paddingInline: 24,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#fff",
            fontWeight: 700,
            fontSize: 18,
            whiteSpace: "nowrap",
          }}
        >
          <ShopOutlined style={{ fontSize: 22 }} />
          B2B Портал
        </Link>

        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[activeKey]}
          items={menuItems}
          style={{ flex: 1, minWidth: 0, background: "transparent" }}
        />

        <Space size={12}>
          <Popover
            trigger="hover"
            placement="bottomRight"
            content={cartPreview}
          >
            <Link
              to="/cart"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "100%",
                padding: "0 8px",
                color: "#fff",
              }}
            >
              <Badge count={cartCount} size="small">
                <ShoppingCartOutlined style={{ fontSize: 20, color: "#fff" }} />
              </Badge>
            </Link>
          </Popover>
          <Space size={8}>
            <Avatar size="small" icon={<UserOutlined />} />
            <Typography.Text style={{ color: "#fff" }}>
              {user?.name}
            </Typography.Text>
          </Space>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            Выйти
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: 24 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Outlet />
        </div>
      </Content>

      <Footer style={{ textAlign: "center", color: "#8c8c8c" }}>
        B2B Портал · учебный проект · {new Date().getFullYear()}
      </Footer>
    </Layout>
  );
}
