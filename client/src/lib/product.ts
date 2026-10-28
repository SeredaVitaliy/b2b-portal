import type { Product, StockStatus, Unit } from "@b2b/shared";

/** Короткие подписи единиц измерения для UI. */
export const unitLabel: Record<Unit, string> = {
  kg: "кг",
  l: "л",
  pcs: "шт",
  box: "кор",
};

/** Текст и цвет тега для статуса наличия. */
export const stockMeta: Record<StockStatus, { label: string; color: string }> = {
  in_stock: { label: "В наличии", color: "green" },
  low: { label: "Мало на складе", color: "orange" },
  out: { label: "Нет в наличии", color: "red" },
};

/** Форматирует цену как рубли по российской локали: 1234.5 → «1 234,50 ₽». */
export function formatPrice(value: number): string {
  return value.toLocaleString("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// --- Подбор картинки товара (демо-заглушки из фото ингредиентов TheMealDB) ---

const INGREDIENTS_BASE = "https://www.themealdb.com/images/ingredients";

/** Русское слово в названии товара → название ингредиента TheMealDB. Первое совпадение выигрывает. */
const nameToIngredient: Array<[string, string]> = [
  ["Мука", "Flour"],
  ["Молоко", "Milk"],
  ["Хлеб", "Bread"],
  ["Батон", "Bread"],
  ["Лаваш", "Bread"],
  ["Булочка", "Bread"],
  ["Круассан", "Bread"],
  ["Пряники", "Bread"],
  ["Печенье", "Bread"],
  ["Блины", "Bread"],
  ["Масло", "Butter"],
  ["Сыр", "Cheese"],
  ["Сметана", "Sour Cream"],
  ["Йогурт", "Yogurt"],
  ["Ряженка", "Yogurt"],
  ["Кефир", "Yogurt"],
  ["Наггетсы", "Chicken"],
  ["Курица", "Chicken"],
  ["Свинина", "Pork"],
  ["Говядина", "Beef"],
  ["Фарш", "Beef"],
  ["Колбаса", "Sausages"],
  ["Сосиски", "Sausages"],
  ["Рыба", "Fish"],
  ["Лосось", "Salmon"],
  ["Сахар", "Sugar"],
  ["Соль", "Salt"],
  ["Рис", "Rice"],
  ["Чечевица", "Lentils"],
  ["Картофель", "Potatoes"],
  ["Томаты", "Tomatoes"],
  ["Помидор", "Tomatoes"],
  ["Морковь", "Carrots"],
  ["Капуста", "Cabbage"],
  ["Огур", "Cucumber"],
  ["Свёкла", "Beetroot"],
  ["Свекла", "Beetroot"],
  ["Ягоды", "Strawberries"],
  ["Лук", "Onion"],
  ["Сок", "Orange Juice"],
  ["Квас", "Water"],
  ["Вода", "Water"],
  ["Чай", "Tea"],
  ["Кофе", "Coffee"],
  ["Мороженое", "Ice Cream"],
  ["Вареники", "Flour"],
  ["Пельмени", "Flour"],
  ["Овощная смесь", "Carrots"],
];

/** Запасной вариант: по названию категории. */
const categoryToIngredient: Record<string, string> = {
  Бакалея: "Flour",
  Выпечка: "Bread",
  Молочное: "Milk",
  Мясо: "Beef",
  Овощи: "Carrots",
  Напитки: "Water",
  Заморозка: "Fish",
};

function ingredientUrl(ingredient: string): string {
  return `${INGREDIENTS_BASE}/${encodeURIComponent(ingredient)}-Small.png`;
}

/**
 * URL картинки товара. Сначала — настоящее imageUrl (если появится), затем подбор
 * по названию, затем по категории. Если ничего не подошло (напр. бытовая химия) — null,
 * и карточка покажет букву-заглушку.
 */
export function productImageUrl(
  product: Product,
  categoryName?: string,
): string | null {
  if (product.imageUrl) return product.imageUrl;

  for (const [keyword, ingredient] of nameToIngredient) {
    if (product.name.includes(keyword)) return ingredientUrl(ingredient);
  }

  if (categoryName && categoryToIngredient[categoryName]) {
    return ingredientUrl(categoryToIngredient[categoryName]);
  }

  return null;
}
