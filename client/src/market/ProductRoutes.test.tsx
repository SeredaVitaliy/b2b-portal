import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App';
import type { Market } from './types';

const market: Market = {
  user: null, history: [], templates: [], addresses: [], favorites: [], customers: [], prices: [], orders: [],
  categories: [{ id: 1, name: 'Фрукты', parent: null }],
  companies: [{
    id: 2, name: 'Фруктовый склад', kind: 'supplier', minimum: 1500, lead_days: 1,
    active: true, description: '', delivery_days: [1, 4], state: 'active', registration: null,
  }],
  products: [{ id: 3, name: 'Яблоки, 2 кг', category: 1, unit: 'уп', approved: true }],
  offers: [{ id: 4, supplier: 2, product: 3, price: null, stock: 5, pack: 1 }],
};

function open(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>
    <App />
  </MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  localStorage.removeItem('sv-market-cart-v1');
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(market)));
  vi.stubGlobal('WebSocket', class { close() {} });
});

afterEach(() => vi.unstubAllGlobals());

test.each(['/catalog', '/suppliers/2'])('ссылка на карточку с фото работает из %s', async path => {
  open(path);
  const heading = await screen.findByRole('heading', { name: 'Яблоки, 2 кг' });
  const link = heading.closest('a')!;
  expect(link).toHaveAttribute('href', '/products/3');
  expect(link.querySelector('img')).toHaveAttribute('src', '/ingredients/apple.jpg');
  fireEvent.click(link);
  expect(await screen.findByRole('heading', { name: 'Яблоки, 2 кг', level: 1 })).toBeVisible();
  expect(screen.getByRole('img', { name: 'Яблоки, 2 кг' })).toHaveAttribute('src', '/ingredients/apple.jpg');
  expect(screen.getByRole('link', { name: 'Фруктовый склад' })).toHaveAttribute('href', '/suppliers/2');
});

test.each(['/products/3', '/product/3', '/catalog/3'])('карточка открывается напрямую по адресу %s', async path => {
  open(path);
  expect(await screen.findByRole('heading', { name: 'Яблоки, 2 кг', level: 1 })).toBeVisible();
  expect(screen.getByText('Цена после входа')).toBeVisible();
});

test('с отсутствующей карточки можно вернуться в каталог', async () => {
  open('/products/999');
  expect(await screen.findByText('Товар не найден')).toBeVisible();
  fireEvent.click(screen.getByRole('link', { name: 'В каталог' }));
  expect(await screen.findByRole('heading', { name: 'Каталог продуктов' })).toBeVisible();
});

test('покупатель добавляет минимальную партию, затем шаг до доступного остатка', async () => {
  const buyerMarket: Market = {
    ...market,
    user: { role: 'buyer', company: 9 },
    offers: [{ ...market.offers[0], price: 300, stock: 8, pack: 4, step: 3 }],
  };
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(buyerMarket)));
  open('/products/3');
  const add = await screen.findByRole('button', { name: 'В корзину' });
  fireEvent.click(add);
  expect(screen.getByText('В корзине 4 уп.')).toBeVisible();
  fireEvent.click(add);
  expect(screen.getByText('В корзине 7 уп.')).toBeVisible();
  expect(add).toBeDisabled();
});
