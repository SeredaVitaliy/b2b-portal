import type { Product } from "@b2b/shared";
import cartReducer, {
  addItem,
  setQuantity,
  removeItem,
  clearCart,
} from "./cartSlice";

// Фабрика тестового товара: отдаёт валидный Product, нужные поля переопределяем.
function makeProduct(overrides: Partial<Product> = {}): Product {
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

describe("cartSlice", () => {
  it("addItem добавляет новую позицию в пустую корзину", () => {
    const product = makeProduct();
    const state = cartReducer({ items: [] }, addItem({ product, quantity: 5 }));

    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toEqual({ product, quantity: 5 });
  });

  it("addItem прибавляет количество, если товар уже в корзине (без дубля)", () => {
    const product = makeProduct();
    const start = { items: [{ product, quantity: 5 }] };
    const state = cartReducer(start, addItem({ product, quantity: 3 }));

    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(8);
  });

  it("setQuantity ставит точное количество нужному товару", () => {
    const product = makeProduct({ id: 2 });
    const start = { items: [{ product, quantity: 5 }] };
    const state = cartReducer(start, setQuantity({ productId: 2, quantity: 12 }));

    expect(state.items[0].quantity).toBe(12);
  });

  it("removeItem убирает позицию по id", () => {
    const first = makeProduct({ id: 1 });
    const second = makeProduct({ id: 2 });
    const start = {
      items: [
        { product: first, quantity: 5 },
        { product: second, quantity: 5 },
      ],
    };
    const state = cartReducer(start, removeItem(1));

    expect(state.items).toHaveLength(1);
    expect(state.items[0].product.id).toBe(2);
  });

  it("clearCart очищает корзину", () => {
    const start = { items: [{ product: makeProduct(), quantity: 5 }] };
    const state = cartReducer(start, clearCart());

    expect(state.items).toEqual([]);
  });
});
