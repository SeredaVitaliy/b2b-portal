# SV маркет

B2B e-commerce для оптовых закупок: каталог, корзина, заказы,
админка каталога/прайсов, реалтайм-остатки. Монорепа на npm workspaces.

## Структура

- `shared/` — общие доменные типы (контракт между фронтом и бэком)
- `server/` — Express + better-sqlite3 + JWT
- `client/` — Vite + React + Redux Toolkit + React Query + Ant Design

## Запуск

```bash
npm install            # в корне, ставит все воркспейсы
npm run seed           # наполнить БД тестовыми данными
npm run dev:server     # бэкенд на http://localhost:4000
npm run dev:client     # фронт на http://localhost:5173
```

Vite проксирует `/api` на бэкенд, поэтому фронт ходит на относительный `/api`.

## Тестовые пользователи

| Роль    | Email            | Пароль     |
|---------|------------------|------------|
| admin   | admin@b2b.dev    | admin123   |
| manager | manager@b2b.dev  | manager123 |
| buyer   | buyer@b2b.dev    | buyer123   |

## API (на текущий момент)

- `GET  /api/health`
- `POST /api/auth/login` → `{ user, tokens }`
- `POST /api/auth/refresh` → `{ accessToken, refreshToken }` (ротация)
- `POST /api/auth/logout`
- `GET  /api/auth/me` (Bearer)
- `GET  /api/categories` (Bearer)
- `GET  /api/products` (Bearer) — фильтры: categoryId, search, minPrice, maxPrice, inStock, sort, page, pageSize
- `GET  /api/products/:id` (Bearer)
