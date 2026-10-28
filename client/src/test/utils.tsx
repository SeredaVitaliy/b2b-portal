import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import type { Product } from "@b2b/shared";
import cartReducer, { type CartItem } from "@/slices/cartSlice";

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
// Для компонентных тестов хватает cart; auth сюда не тянем (его компоненты карточки не читают).
export function makeStore(cartItems: CartItem[] = []) {
  return configureStore({
    reducer: { cart: cartReducer },
    preloadedState: { cart: { items: cartItems } },
  });
}

// Рендерит компонент, обёрнутый в Redux-стор и роутер (многим компонентам нужны оба).
export function renderWithProviders(
  ui: ReactElement,
  cartItems: CartItem[] = [],
) {
  const store = makeStore(cartItems);
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter>{ui}</MemoryRouter>
      </Provider>,
    ),
  };
}
