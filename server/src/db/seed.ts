import type { Unit } from "@b2b/shared";
import { db, initSchema } from "./index";
import { hashPassword } from "../auth/password";

initSchema();

// Категории: имя, slug, единица измерения, базовые названия товаров.
const CATEGORIES: Array<{
  name: string;
  slug: string;
  unit: Unit;
  items: string[];
}> = [
  { name: "Бакалея", slug: "bakaleya", unit: "kg", items: ["Сахар", "Соль", "Мука", "Рис", "Гречка", "Макароны", "Овсянка", "Чечевица"] },
  { name: "Напитки", slug: "napitki", unit: "l", items: ["Вода", "Сок яблочный", "Сок апельсиновый", "Лимонад", "Чай чёрный", "Кофе зерновой", "Морс", "Квас"] },
  { name: "Молочное", slug: "molochnoe", unit: "l", items: ["Молоко", "Кефир", "Сливки", "Йогурт", "Сметана", "Ряженка", "Масло сливочное", "Творог"] },
  { name: "Мясо", slug: "myaso", unit: "kg", items: ["Курица", "Говядина", "Свинина", "Индейка", "Фарш", "Сосиски", "Колбаса", "Бекон"] },
  { name: "Овощи", slug: "ovoshchi", unit: "kg", items: ["Картофель", "Морковь", "Лук", "Капуста", "Томаты", "Огурцы", "Перец", "Свёкла"] },
  { name: "Бытовая химия", slug: "bytovaya-himiya", unit: "pcs", items: ["Мыло", "Порошок", "Гель для посуды", "Салфетки", "Губки", "Освежитель", "Перчатки", "Пакеты"] },
  { name: "Выпечка", slug: "vypechka", unit: "pcs", items: ["Хлеб", "Батон", "Булочка", "Багет", "Лаваш", "Круассан", "Печенье", "Пряники"] },
  { name: "Заморозка", slug: "zamorozka", unit: "box", items: ["Пельмени", "Вареники", "Овощная смесь", "Ягоды", "Рыба", "Наггетсы", "Блины", "Мороженое"] },
];

const UNITS_MIN_BATCH: Record<Unit, { minBatch: number; step: number }> = {
  kg: { minBatch: 5, step: 5 },
  l: { minBatch: 6, step: 6 },
  pcs: { minBatch: 10, step: 10 },
  box: { minBatch: 2, step: 2 },
};

const PER_CATEGORY = 40;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const reset = db.transaction(() => {
  db.exec(`
    DELETE FROM refresh_tokens;
    DELETE FROM products;
    DELETE FROM categories;
    DELETE FROM users;
    DELETE FROM companies;
    DELETE FROM sqlite_sequence;
  `);

  // --- Компании ---
  const insCompany = db.prepare("INSERT INTO companies (name) VALUES (?)");
  const company1 = Number(insCompany.run("ООО Ромашка").lastInsertRowid);
  insCompany.run("ТД Восток");

  // --- Пользователи (пароли см. в README) ---
  const insUser = db.prepare(
    "INSERT INTO users (email, password_hash, name, role, company_id) VALUES (?, ?, ?, ?, ?)",
  );
  insUser.run("admin@b2b.dev", hashPassword("admin123"), "Администратор каталога", "admin", null);
  insUser.run("manager@b2b.dev", hashPassword("manager123"), "Менеджер каталога", "manager", null);
  insUser.run("buyer@b2b.dev", hashPassword("buyer123"), "Закупщик Ромашки", "buyer", company1);

  // --- Категории и товары ---
  const insCat = db.prepare("INSERT INTO categories (parent_id, name, slug) VALUES (NULL, ?, ?)");
  const insProduct = db.prepare(`
    INSERT INTO products
      (sku, name, description, category_id, unit, base_price, min_batch, step, stock, popularity, image_url)
    VALUES
      (@sku, @name, @description, @category_id, @unit, @base_price, @min_batch, @step, @stock, @popularity, @image_url)
  `);

  let productCount = 0;

  for (const cat of CATEGORIES) {
    const categoryId = Number(insCat.run(cat.name, cat.slug).lastInsertRowid);
    const { minBatch, step } = UNITS_MIN_BATCH[cat.unit];

    for (let i = 0; i < PER_CATEGORY; i++) {
      const base = cat.items[i % cat.items.length];
      const variant = Math.floor(i / cat.items.length) + 1;
      const name = variant > 1 ? `${base} №${variant}` : base;
      productCount += 1;

      insProduct.run({
        sku: `${cat.slug.toUpperCase().slice(0, 4)}-${String(productCount).padStart(4, "0")}`,
        name,
        description: `${name}, категория «${cat.name}». Оптовая позиция для B2B-закупок.`,
        category_id: categoryId,
        unit: cat.unit,
        base_price: Number((randInt(50, 5000) / 10).toFixed(2)),
        min_batch: minBatch,
        step,
        // Намеренно разный остаток: часть 0 (нет), часть мало (<=15), часть много.
        stock: [0, randInt(1, 15), randInt(16, 400)][randInt(0, 2)],
        popularity: randInt(0, 1000),
        image_url: null,
      });
    }
  }

  return productCount;
});

const count = reset();
console.log(`Сид выполнен: 2 компании, 3 пользователя, ${CATEGORIES.length} категорий, ${count} товаров.`);
