import { Link, Outlet, useNavigate } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button,
  Divider,
  Dropdown,
  Input,
  Layout,
  Popover,
  Space,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import { formatPrice } from "@/lib/product";
import {
  AppstoreOutlined,
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
  const [search, setSearch] = useState("");
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

  // Меню профиля: личные разделы закупщика + (по ролям) управление. Так верхняя
  // полоса остаётся чистой — только логотип, «Каталог», поиск, корзина, профиль.
  const profileMenuItems: MenuProps["items"] = [
    { key: "/profile", label: "Профиль", icon: <UserOutlined /> },
    { key: "/orders", label: "Мои заказы" },
    { key: "/favorites", label: "Избранное" },
    { key: "/templates", label: "Шаблоны" },
    ...(isEditor
      ? [
          { type: "divider" as const },
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

  // Поиск из шапки ведёт на каталог с ?search — состояние каталога живёт в URL.
  const submitSearch = (value: string) => {
    const q = value.trim();
    navigate(q ? `/catalog?search=${encodeURIComponent(q)}` : "/catalog");
  };

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
          padding: 0,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            height: "100%",
            margin: "0 auto",
            paddingInline: 24,
            display: "flex",
            alignItems: "center",
            gap: 16,
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

        <Button
          type="primary"
          icon={<AppstoreOutlined />}
          onClick={() => navigate("/catalog")}
        >
          Каталог
        </Button>

        <Input.Search
          placeholder="Поиск товаров по названию или артикулу"
          allowClear
          enterButton
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={submitSearch}
          style={{ flex: 1, maxWidth: 560 }}
        />

        <Space size={12} align="center" style={{ marginLeft: "auto" }}>
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
                gap: 8,
                height: 40,
                padding: "0 14px",
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
              {cartItems.length > 0 && (
                <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                  {formatPrice(cartTotal)}
                </span>
              )}
            </Link>
          </Popover>

          <Dropdown
            menu={{ items: profileMenuItems, onClick: onProfileMenuClick }}
            trigger={["hover"]}
            placement="bottomRight"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                color: "#fff",
                height: 40,
                padding: "0 10px",
                borderRadius: 8,
                whiteSpace: "nowrap",
              }}
            >
              <Avatar size="small" icon={<UserOutlined />} />
              <span
                style={{
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user?.name}
              </span>
              <DownOutlined
                style={{ fontSize: 10, color: "rgba(255,255,255,0.65)" }}
              />
            </div>
          </Dropdown>
        </Space>
        </div>
      </Header>

      <Content style={{ padding: 24 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <Outlet />
        </div>
      </Content>

      <Footer style={{ textAlign: "center", color: "#8c8c8c" }}>
        SV group · {new Date().getFullYear()}
      </Footer>
    </Layout>
  );
}
