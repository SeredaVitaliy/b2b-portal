import { createBrowserRouter, RouterProvider } from "react-router-dom";

import LoginPage from "./pages/LoginPage/LoginPage";
import PrivateRoute from "./components/PrivateRoute/PrivateRoute";
import AppLayout from "./components/AppLayout/AppLayout";
import HomePage from "./pages/HomePage/HomePage";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { useEffect, useRef } from "react";
import { initialAuth } from "./slices/authSlice";
import CatalogPage from "./pages/CatalogPage/CatalogPage";
import ProductPage from "./pages/ProductPage/ProductPage";
import CartPage from "./pages/CartPage/CartPage";
import OrdersPage from "./pages/OrdersPage/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage/OrderDetailPage";
import FavoritesPage from "./pages/FavoritesPage/FavoritesPage";
import TemplatesPage from "./pages/TemplatesPage/TemplatesPage";
import UsersPage from "./pages/UsersPage/UsersPage";
import AllProductsPage from "./pages/AllProductsPage/AllProductsPage";
import MassEditPage from "./pages/MassEditPage/MassEditPage";
import MassImportPage from "./pages/MassImportPage/MassImportPage";
import PricingPage from "./pages/PricingPage/PricingPage";
import ChangeHistoryPage from "./pages/ChangeHistoryPage/ChangeHistoryPage";
import CategoriesPage from "./pages/CategoriesPage/CategoriesPage";
const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/catalog", element: <CatalogPage /> },
          { path: "/all-products", element: <AllProductsPage /> },
          {
            path: "/catalog/:id",
            element: <ProductPage />,
          },
          { path: "/cart", element: <CartPage /> },
          { path: "/orders", element: <OrdersPage /> },
          { path: "/orders/:id", element: <OrderDetailPage /> },
          { path: "/favorites", element: <FavoritesPage /> },
          { path: "/templates", element: <TemplatesPage /> },
          { path: "/users", element: <UsersPage /> },
          { path: "/mass-edit", element: <MassEditPage /> },
          { path: "/import", element: <MassImportPage /> },
          { path: "/pricing", element: <PricingPage /> },
          { path: "/change-history", element: <ChangeHistoryPage /> },
          { path: "/categories", element: <CategoriesPage /> },
        ],
      },
    ],
  },
]);

export default function App() {
  const dispatch = useAppDispatch();
  const isInitialized = useAppSelector((state) => state.auth.isInitialized);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    dispatch(initialAuth());
  }, [dispatch]);

  if (!isInitialized) return null;
  return <RouterProvider router={router} />;
}
