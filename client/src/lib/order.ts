import { OrderStatus } from "@b2b/shared";

export const orderStatusMeta: Record<
  OrderStatus,
  { label: string; color: string }
> = {
  new: { label: "Новый", color: "blue" },
  processing: { label: "В обработке", color: "orange" },
  shipped: { label: "Отгружен", color: "green" },
  cancelled: { label: "Отменен", color: "red" },
};

export function formatDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("ru-Ru", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
