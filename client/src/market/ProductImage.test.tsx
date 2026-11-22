import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ProductImage } from './ProductImage';
import type { Product } from './types';

const migrations = resolve('../market/migrations');
const seed = readFileSync(resolve(migrations, '202611210001_market.sql'), 'utf8');
const ingredients = [...seed.matchAll(/^ \(\d+,'([^']+)','(?:кг|шт|уп)'\)/gm)]
  .flatMap(([, names]) => names.split(','));

test('каждый товар начального каталога использует фотографию своего продукта', () => {
  expect(ingredients).toHaveLength(64);
  const sources = new Set<string>();

  for (const [index, ingredient] of ingredients.entries()) {
    const product: Product = { id: index + 1, name: `${ingredient}, 1 кг`, category: 1, unit: 'уп', approved: true };
    const html = renderToStaticMarkup(<ProductImage product={product} />);
    const source = html.match(/src="(\/ingredients\/[a-z-]+\.jpg)"/)?.[1];
    expect(source, ingredient).toBeDefined();
    const jpeg = readFileSync(resolve('public', `.${source}`));
    expect(jpeg.subarray(0, 3).toString('hex'), ingredient).toBe('ffd8ff');
    sources.add(source!);
  }

  expect(sources.size).toBe(ingredients.length);
});
