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
import { useEffect, useState } from "react";
import { getFavorites } from "@/api/FavoritesApi";
import { setFavorites } from "@/slices/favoritesSlice";
import { useStockSocket } from "@/hooks/useStockSocket";

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
  const [cartHover, setCartHover] = useState(false);
  useStockSocket();

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
    { key: "/all-products", label: <Link to="/all-products">Все товары</Link> },
    { key: "/orders", label: <Link to="/orders">Мои заказы</Link> },
    { key: "/favorites", label: <Link to="/favorites">Избранное</Link> },
    { key: "/templates", label: <Link to="/templates">Шаблоны</Link> },
    ...(user?.role === "admin"
      ? [{ key: "/users", label: <Link to="/users">Пользователи</Link> }]
      : []),
    ...(user?.role === "admin" || user?.role === "manager"
      ? [
          {
            key: "/mass-edit",
            label: <Link to="/mass-edit">Редактор цен</Link>,
          },
        ]
      : []),
    ...(user?.role === "admin" || user?.role === "manager"
      ? [{ key: "/import", label: <Link to="/import">Импорт CSV</Link> }]
      : []),
    ...(user?.role === "admin" || user?.role === "manager"
      ? [{ key: "/pricing", label: <Link to="/pricing">Прайсы клиентов</Link> }]
      : []),
    ...(user?.role === "admin" || user?.role === "manager"
      ? [
          {
            key: "/change-history",
            label: <Link to="/change-history">История изменений</Link>,
          },
        ]
      : []),
    ...(user?.role === "admin" || user?.role === "manager"
      ? [{ key: "/categories", label: <Link to="/categories">Категории</Link> }]
      : []),
  ];

  // Какой пункт меню подсветить: по началу пути (чтобы /catalog/5 и /orders/3 тоже подсвечивались).
  const activeKey = location.pathname.startsWith("/categories")
    ? "/categories"
    : location.pathname.startsWith("/change-history")
    ? "/change-history"
    : location.pathname.startsWith("/mass-edit")
    ? "/mass-edit"
    : location.pathname.startsWith("/all-products")
      ? "/all-products"
      : location.pathname.startsWith("/catalog")
        ? "/catalog"
        : location.pathname.startsWith("/orders")
          ? "/orders"
          : location.pathname.startsWith("/favorites")
            ? "/favorites"
            : location.pathname.startsWith("/templates")
              ? "/templates"
              : location.pathname.startsWith("/users")
                ? "/users"
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

        <Space size={12} align="center">
          <Popover
            trigger="hover"
            placement="bottomRight"
            content={cartPreview}
          >
            <Link
              to="/cart"
              onMouseEnter={() => setCartHover(true)}
              onMouseLeave={() => setCartHover(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 40,
                padding: "0 14px",
                marginRight: 8,
                borderRadius: 8,
                color: "#fff",
                background: cartHover
                  ? "rgba(255,255,255,0.16)"
                  : "transparent",
                transition: "background 0.2s",
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
