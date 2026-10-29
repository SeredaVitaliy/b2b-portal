import { message } from "antd";
import { useNavigate } from "react-router-dom";
import type { Order } from "@b2b/shared";
import { getProductsByIds } from "@/api/ProductApi";
import { addItem } from "@/slices/cartSlice";
import { useAppDispatch } from "@/store/hooks";

// Общая логика «Повторить заказ»: тянем АКТУАЛЬНЫЕ товары по id из заказа,
// доступные кладём в корзину по текущей цене (кол-во не ниже новой минпартии),
// недоступные пропускаем и показываем в предупреждении. Переходим в корзину,
// только если что-то добавили. Используется и в деталях заказа, и в списке.
export function useRepeatOrder() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return async function repeatOrder(order: Order) {
    const current = await getProductsByIds(order.items.map((i) => i.productId));
    const byId = new Map(current.map((p) => [p.id, p]));

    const unavailable: string[] = [];
    let added = 0;

    for (const item of order.items) {
      const product = byId.get(item.productId);
      if (!product || product.stockStatus === "out") {
        unavailable.push(item.name);
        continue;
      }
      dispatch(
        addItem({
          product,
          quantity: Math.max(product.minBatch, item.quantity),
        }),
      );
      added++;
    }

    if (added > 0) {
      message.success(`Добавлено в корзину: ${added}`);
      navigate("/cart");
    }
    if (unavailable.length > 0) {
      message.warning(`Недоступны и пропущены: ${unavailable.join(", ")}`);
    }
  };
}
