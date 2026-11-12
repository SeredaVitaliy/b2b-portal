import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button,
  Divider,
  Dropdown,
  Layout,
  Menu,
  Popover,
  Space,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import { formatPrice } from "@/lib/product";
import {
  DownOutlined,
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
import { useMyOverrides } from "@/hooks/useBuyerPrice";
import { resolveBuyerPrice } from "@b2b/shared";

const { Header, Content, Footer } = Layout;

export default function AppLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);
  const cartCount = useAppSelector((state) => state.cart.items.length);
  const cartItems = useAppSelector((state) => state.cart.items);
  // Итог в превью корзины — по персональной цене (как на странице корзины).
  const { data: overrides } = useMyOverrides();
  const ovr = overrides ?? { products: {}, categories: {} };
  const priceOf = (p: { id: number; categoryId: number; basePrice: number }) =>
    resolveBuyerPrice(p, ovr);
  const cartTotal = cartItems.reduce(
    (sum, i) => sum + priceOf(i.product) * i.quantity,
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

  const isEditor = user?.role === "admin" || user?.role === "manager";
  const isAdmin = user?.role === "admin";

  // Верхняя полоса — только витрина и личный кабинет. Всё админское вынесено
  // в выпадающее меню профиля, чтобы шапка не превращалась в длинную ленту.
  const menuItems = [
    { key: "/", label: <Link to="/">Главная</Link> },
    { key: "/catalog", label: <Link to="/catalog">Каталог</Link> },
    { key: "/all-products", label: <Link to="/all-products">Все товары</Link> },
    { key: "/orders", label: <Link to="/orders">Мои заказы</Link> },
    { key: "/favorites", label: <Link to="/favorites">Избранное</Link> },
    { key: "/templates", label: <Link to="/templates">Шаблоны</Link> },
  ];

  // Меню профиля (по ролям): управление прайсами/категориями/пользователями
  // живёт здесь. Прайс-листы — отдельное подменю, чтобы сгруппировать всё по ценам.
  const profileMenuItems: MenuProps["items"] = [
    { key: "/profile", label: "Профиль", icon: <UserOutlined /> },
    ...(isEditor
      ? [
          {
            key: "pricelists",
            label: "Прайс-листы",
            children: [
              { key: "/mass-edit", label: "Редактор цен" },
              { key: "/import", label: "Импорт CSV" },
              { key: "/pricing", label: "Прайсы клиентов" },
              { key: "/change-history", label: "История изменений" },
            ],
          },
          { key: "/categories", label: "Редактор категорий" },
        ]
      : []),
    ...(isAdmin ? [{ key: "/users", label: "Пользователи" }] : []),
    { type: "divider" as const },
    { key: "logout", label: "Выйти", icon: <LogoutOutlined />, danger: true },
  ];

  const onProfileMenuClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "logout") handleLogout();
    else navigate(key);
  };

  // Подсветка пункта верхней полосы (пункты из выпадашки её не подсвечивают).
  const activeKey = location.pathname.startsWith("/all-products")
    ? "/all-products"
    : location.pathname.startsWith("/catalog")
      ? "/catalog"
      : location.pathname.startsWith("/orders")
        ? "/orders"
        : location.pathname.startsWith("/favorites")
          ? "/favorites"
          : location.pathname.startsWith("/templates")
            ? "/templates"
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
                {i.quantity} × {formatPrice(priceOf(i.product))}
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
          SV маркет
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
          <Dropdown
            menu={{ items: profileMenuItems, onClick: onProfileMenuClick }}
            trigger={["hover"]}
            placement="bottomRight"
          >
            <Space
              size={8}
              style={{
                cursor: "pointer",
                color: "#fff",
                height: 40,
                padding: "0 10px",
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Avatar size="small" icon={<UserOutlined />} />
              <Typography.Text style={{ color: "#fff" }}>
                {user?.name}
              </Typography.Text>
              <DownOutlined
                style={{ fontSize: 10, color: "rgba(255,255,255,0.65)" }}
              />
            </Space>
          </Dropdown>
        </Space>
      </Header>

      <Content style={{ padding: 24 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Outlet />
        </div>
      </Content>

      <Footer style={{ textAlign: "center", color: "#8c8c8c" }}>
        SV group · {new Date().getFullYear()}
      </Footer>
    </Layout>
  );
}
