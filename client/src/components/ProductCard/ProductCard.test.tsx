import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeProduct } from "@/test/utils";
import ProductCard from "./ProductCard";

describe("ProductCard", () => {
  it("товар не в корзине — показывает кнопку «В корзину»", () => {
    renderWithProviders(<ProductCard product={makeProduct()} />);

    expect(
      screen.getByRole("button", { name: "В корзину" }),
    ).toBeInTheDocument();
  });

  it("клик «В корзину» добавляет товар в стор и меняет кнопку на степпер", async () => {
    const product = makeProduct();
    const { store } = renderWithProviders(<ProductCard product={product} />);

    await userEvent.click(screen.getByRole("button", { name: "В корзину" }));

    // в сторе появилась позиция с минимальной партией
    expect(store.getState().cart.items).toEqual([
      { product, quantity: product.minBatch },
    ]);
    // кнопка «В корзину» пропала, появился степпер (плюс)
    expect(
      screen.queryByRole("button", { name: "В корзину" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "plus" })).toBeInTheDocument();
  });

  it("клик «Удалить» убирает товар из стора", async () => {
    const product = makeProduct({ id: 2 });
    const { store } = renderWithProviders(<ProductCard product={product} />, [
      { product, quantity: 5 },
    ]);

    await userEvent.click(screen.getByRole("button", { name: "delete" }));

    expect(store.getState().cart.items).toEqual([]);
  });
});
