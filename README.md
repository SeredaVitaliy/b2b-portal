# B2B Portal

Портал оптовых закупок для бизнес-клиентов: каталог, корзина, оформление и повтор заказов, шаблоны регулярных закупок, остатки на складе в реальном времени и админка. Fullstack-монорепа на TypeScript: React-клиент, Express-сервер и общий пакет типов между ними.

> Проект в активной разработке, новые фичи появляются в ветках `features-*` и вливаются в `main`.

## Стек

| Слой | Технологии |
|------|------------|
| Клиент | React 19, TypeScript, Vite, Redux Toolkit, React Query, Ant Design 6, React Router 7, react-window |
| Сервер | Node.js 22, Express, TypeScript, better-sqlite3, JWT (access + refresh), bcrypt, WebSocket |
| Общее | npm workspaces, пакет `@b2b/shared` с доменными типами (единый контракт фронта и бэка) |
| Тесты | Vitest + Testing Library (unit и компонентные), Vitest на бэке, Playwright (e2e) |

## Что умеет

- **Авторизация и роли.** JWT с ротацией refresh-токенов, автоматическое обновление access-токена в интерсепторе Axios, роли `admin`, `manager`, `buyer` и приватные маршруты.
- **Каталог.** Категории, фильтры (цена, наличие, сортировка, пагинация), живой поиск с debounce и подсветкой совпадений, виртуализированная сетка на react-window для больших каталогов.
- **Остатки в реальном времени.** Сервер рассылает изменения склада по WebSocket, карточки товаров обновляются без перезагрузки.
- **Корзина и заказы.** Оформление с комментарием и желаемой датой доставки, история заказов с фильтрами, повтор заказа в один клик.
- **Избранное и «часто заказываемое»** на главной странице.
- **Шаблоны закупок.** Сохранить корзину как шаблон и применить его позже.
- **Админка.** Управление пользователями и ролями.

**В разработке** (ветки `features-*`): персональные цены клиента поверх базового прайса, импорт и экспорт каталога в CSV, массовое редактирование, проверка наличия в корзине.

## Структура

```
shared/   общие доменные типы (контракт между клиентом и сервером)
server/   Express API: routes → repositories → SQLite, JWT-мидлвары, WebSocket
client/   SPA: pages, components, Redux slices, хуки, API-слой на Axios
e2e/      сценарии Playwright
```

## Запуск

Нужен Node.js 22+.

```bash
npm install                          # в корне, ставит все воркспейсы
cp server/.env.example server/.env   # локальные настройки (необязательно, есть значения по умолчанию)
npm run seed                         # наполнить БД тестовыми данными
npm run dev:server                   # API на http://localhost:4000
npm run dev:client                   # клиент на http://localhost:5173
```

Vite проксирует `/api` на сервер, поэтому клиент обращается к относительному `/api`.

### Тестовые пользователи

Создаются командой `npm run seed`, работают только локально.

| Роль    | Email            | Пароль     |
|---------|------------------|------------|
| admin   | admin@b2b.dev    | admin123   |
| manager | manager@b2b.dev  | manager123 |
| buyer   | buyer@b2b.dev    | buyer123   |

## Тесты

```bash
npm run test:run -w client   # unit и компонентные тесты клиента
npm run test:run -w server   # тесты репозиториев сервера
npm run test:e2e             # e2e на Playwright (поднимите сервер и клиент)
```

## API (основное)

- `POST /api/auth/login`, `POST /api/auth/refresh` (ротация), `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/categories`, `GET /api/products`, `GET /api/products/:id`
- заказы, избранное, шаблоны, пользователи и остатки: роуты в `server/src/routes/`

Все маршруты, кроме логина и refresh, требуют заголовок `Authorization: Bearer <accessToken>`.
