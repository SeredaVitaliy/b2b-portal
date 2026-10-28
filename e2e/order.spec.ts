import { test, expect } from "@playwright/test";

// Happy-path: весь путь покупателя от входа до оформленного заказа.
test("покупатель оформляет заказ: логин → каталог → корзина → оформление", async ({
  page,
}) => {
  // 1. Логин демо-пользователем.
  await page.goto("/login");
  await page.getByPlaceholder("you@company.dev").fill("buyer@b2b.dev");
  await page.getByPlaceholder("••••••••").fill("buyer123");
  await page.getByRole("button", { name: "Войти" }).click();

  // Дождаться входа: в шапке (banner) появилось имя пользователя.
  await expect(
    page.getByRole("banner").getByText("Закупщик Ромашки"),
  ).toBeVisible();

  // 2. Каталог — переходим кликом по меню (SPA-навигация, не теряем токен в памяти).
  await page.getByRole("menuitem", { name: "Каталог" }).click();
  await expect(page).toHaveURL(/\/catalog$/);

  // Добавляем первый товар в наличии.
  await page.getByRole("button", { name: "В корзину" }).first().click();

  // 3. Корзина — клик по иконке в шапке.
  await page.locator('header a[href="/cart"]').first().click();
  await expect(page).toHaveURL(/\/cart$/);

  // 4. Оформляем заказ.
  await page.getByRole("button", { name: "Оформить заказ" }).click();

  // 5. Проверка: ушли в «Мои заказы» и там появился заказ.
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByText(/Заказ №\d+/).first()).toBeVisible();
});
