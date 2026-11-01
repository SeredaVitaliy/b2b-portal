import { getProductsByIds } from "@/api/ProductApi";
import { addItem } from "@/slices/cartSlice";
import { useAppDispatch } from "@/store/hooks";
import { OrderTemplate } from "@b2b/shared";
import { message } from "antd";
import { useNavigate } from "react-router-dom";

export function useApplyTemplate() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return async function applyTemplate(template: OrderTemplate) {
    const current = await getProductsByIds(
      template.items.map((i) => i.productId),
    );
    const byId = new Map(current.map((p) => [p.id, p]));
    const unavailable: string[] = [];
    let added = 0;

    for (const item of template.items) {
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
