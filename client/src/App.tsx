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
          {
            path: "/catalog/:id",
            element: <ProductPage />,
          },
          { path: "/cart", element: <CartPage /> },
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
