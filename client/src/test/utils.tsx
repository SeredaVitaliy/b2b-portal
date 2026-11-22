import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Product } from "@b2b/shared";
import cartReducer, { type CartItem } from "@/slices/cartSlice";
import favoritesReducer from "@/slices/favoritesSlice";
import stockReducer from "@/slices/stockSlice";

// Фабрика тестового товара: отдаёт валидный Product, нужные поля переопределяем.
export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    sku: "TEST-001",
    name: "Тестовый товар",
    description: "",
    categoryId: 1,
    unit: "pcs",
    basePrice: 100,
    minBatch: 5,
    step: 1,
    stock: 50,
    stockStatus: "in_stock",
    popularity: 0,
    imageUrl: null,
    ...overrides,
  };
}

// Свежий стор на нужных редьюсерах — у каждого теста своё изолированное состояние.
export function makeStore(cartItems: CartItem[] = []) {
  return configureStore({
    reducer: { cart: cartReducer, favorites: favoritesReducer, stock: stockReducer },
    preloadedState: { cart: { items: cartItems } },
  });
}

// Рендерит компонент, обёрнутый в Redux-стор и роутер (многим компонентам нужны оба).
export function renderWithProviders(
  ui: ReactElement,
  cartItems: CartItem[] = [],
) {
  const store = makeStore(cartItems);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    store,
    ...render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{ui}</MemoryRouter>
        </QueryClientProvider>
      </Provider>,
    ),
  };
}
