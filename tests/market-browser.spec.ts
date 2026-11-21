import {randomUUID} from 'node:crypto';
import {expect, test} from '@playwright/test';
import type {Market} from '../client/src/market/types';

test('гость сравнивает предложения, закупщик оформляет корзину, поставщик подтверждает заказ', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Каталог продуктов'})).toBeVisible();
  await expect(page.getByRole('button', {name: /Цена после входа/}).first()).toBeVisible();
  await expect(page.getByRole('button', {name: 'Заказы', exact: true})).toHaveCount(0);

  await page.getByRole('button', {name: 'Демо-вход'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Закупщик', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Заказы', exact: true})).toBeVisible();

  const catalog: Market = await (await page.request.get('/api/market/market')).json();
  const affordable = (product: number) => catalog.offers.filter(offer => {
    const company = catalog.companies.find(item => item.id === offer.supplier)!;
    return offer.product === product && offer.price !== null && offer.price > 0 &&
      offer.stock >= Math.ceil(company.minimum / offer.price / offer.pack) * offer.pack;
  });
  const product = catalog.products.find(item => {
    const offers = affordable(item.id);
    return offers.length >= 2 && offers.some(offer => offer.supplier === 1);
  })!;
  const offers = affordable(product.id);
  const selected = [offers.find(offer => offer.supplier === 1)!, offers.find(offer => offer.supplier !== 1)!];

  await page.getByRole('textbox', {name: 'Поиск'}).fill(product.name);
  await page.getByRole('button').filter({has: page.getByRole('heading', {name: product.name, exact: true})}).click();
  const details = page.getByRole('dialog');
  for (const offer of selected) {
    const company = catalog.companies.find(item => item.id === offer.supplier)!;
    const row = details.getByRole('article').filter({hasText: company.name});
    await expect(row.getByText(/₽/)).toBeVisible();
    await row.getByRole('button', {name: 'В корзину'}).click();
  }
  await details.getByRole('button', {name: 'Close'}).click();
  await page.getByRole('button', {name: 'Открыть корзину'}).click();
  const cart = page.getByRole('dialog');
  await expect(cart.getByRole('article')).toHaveCount(2);
  for (const offer of selected) {
    const company = catalog.companies.find(item => item.id === offer.supplier)!;
    const row = cart.getByRole('article').filter({hasText: company.name});
    const quantity = Math.max(offer.pack, Math.ceil(company.minimum / offer.price! / offer.pack) * offer.pack);
    const input = row.getByRole('spinbutton', {name: 'Количество'});
    await input.fill(String(quantity));
    await input.press('Tab');
  }
  const note = 'Проверка корзины ' + randomUUID();
  await cart.getByLabel('Комментарий').fill(note);
  const submitted = page.waitForResponse(response => response.url().endsWith('/api/market/checkout'));
  await cart.getByRole('button', {name: /Оформить/}).click();
  expect((await submitted).status()).toBe(200);
  await expect(page.getByText('Заказы переданы поставщикам')).toBeVisible();

  const orders = page.getByRole('article').filter({hasText: note});
  await expect(orders).toHaveCount(2);
  const template = 'Утренняя закупка ' + randomUUID();
  await orders.first().getByRole('button', {name: 'Сохранить как шаблон'}).click();
  await page.getByRole('textbox', {name: 'Название шаблона'}).fill(template);
  await page.getByRole('button', {name: 'Сохранить шаблон', exact: true}).click();
  await page.getByRole('button', {name: 'Закупки', exact: true}).click();
  const savedTemplate = page.getByRole('article').filter({hasText: template});
  await savedTemplate.getByRole('button', {name: 'Загрузить в корзину'}).click();
  await expect(page.getByRole('dialog').getByText(product.name, {exact:true})).toBeVisible();
  await page.getByRole('dialog').getByRole('button', {name: 'Close'}).click();
  await page.getByRole('button', {name: 'Закупщик', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Поставщик', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Кабинет', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Заказы', exact: true}).click();
  await expect(orders).toHaveCount(1);
  await orders.getByRole('button', {name: 'Подтверждён', exact: true}).click();
  await expect(orders.getByRole('button', {name: 'Собирается', exact: true})).toBeVisible();
  await orders.getByText('Обсуждение заказа', {exact:true}).click();
  await orders.getByRole('textbox',{name:'Сообщение к заказу'}).fill('Все позиции в наличии');
  await orders.getByRole('button',{name:'Отправить сообщение'}).click();
  await expect(orders.getByText('Все позиции в наличии')).toBeVisible();
});

test('поставщик подаёт карточку, менеджер публикует её в каталоге', async ({page}) => {
  const title = 'Тестовый товар ' + randomUUID();
  await page.goto('/');
  await page.getByRole('button', {name: 'Демо-вход'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Поставщик', exact: true}).click();
  await page.getByRole('button', {name: 'Кабинет', exact: true}).click();
  await page.getByRole('textbox', {name: 'Название', exact: true}).fill(title);
  await page.getByRole('button', {name: 'На модерацию'}).click();
  await expect(page.getByText(title + ' · На проверке')).toBeVisible();

  await page.getByRole('button', {name: 'Поставщик', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Менеджер портала', exact: true}).click();
  await expect(page.getByRole('banner').getByRole('button', {name: 'Менеджер портала', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Кабинет', exact: true}).click();
  const draft = page.getByRole('article').filter({hasText: title});
  await draft.getByRole('button', {name: 'Одобрить'}).click();
  await expect(draft).toHaveCount(0);

  await page.getByRole('button', {name: 'Каталог', exact: true}).click();
  await page.getByRole('textbox', {name: 'Поиск'}).fill(title);
  await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
});

test('поставщик выгружает CSV и сохраняет несколько изменённых строк', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Демо-вход'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Поставщик', exact: true}).click();
  await page.getByRole('button', {name: 'Кабинет', exact: true}).click();
  const data: Market = await (await page.request.get('/api/market/market')).json();
  const owned = data.offers.filter(offer => offer.supplier === data.user?.company).slice(0, 2);
  expect(owned).toHaveLength(2);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Экспорт CSV'}).click();
  const csv = await downloaded;
  expect(csv.suggestedFilename()).toBe('ассортимент.csv');

  await page.locator('input[type=file]').setInputFiles({
    name: 'import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('id,price,stock\n'+owned.map(offer=>[offer.id,offer.price!+5,offer.stock+2].join(',')).join('\n')),
  });
  const saved = page.waitForResponse(response=>response.url().endsWith('/offers-batch'));
  await page.getByRole('button', {name: /Сохранить изменения.*2/}).click();
  expect((await saved).status()).toBe(200);
  const after: Market = await (await page.request.get('/api/market/market')).json();
  expect(after.history.some(entry=>entry.price_after===owned[0].price!+5 && entry.stock_after===owned[0].stock+2)).toBe(true);
  for (const offer of owned) {
    expect(after.offers.find(item=>item.id===offer.id)).toMatchObject({price:offer.price!+5,stock:offer.stock+2});
  }
});

test('заявка одобряется менеджером, а витрина доступна на телефоне', async ({page}) => {
  const company = 'Поставщик ' + randomUUID();
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Каталог продуктов'})).toBeVisible();
  const hero = await page.request.get('/market-hero.jpg');
  expect(hero.status()).toBe(200);
  expect(hero.headers()['content-type']).toContain('image');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button',{name:'Поставщики',exact:true}).click();
  await page.getByRole('button',{name:'Подать заявку'}).click();
  await page.getByRole('textbox',{name:'Название компании'}).fill(company);
  await page.getByRole('textbox',{name:'Код заявки'}).fill('0123456789');
  await page.getByRole('button',{name:'Отправить заявку'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:company,exact:true})).toHaveCount(0);

  await page.getByRole('button',{name:'Демо-вход'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Менеджер портала',exact:true}).click();
  await page.getByRole('button',{name:'Кабинет',exact:true}).click();
  const registration = page.getByRole('article').filter({hasText:company});
  await registration.getByRole('button',{name:'Одобрить заявку'}).click();
  await expect(registration.getByRole('button',{name:'Приостановить'})).toBeVisible();

  await page.getByRole('textbox',{name:'Название категории'}).fill('Овощное сырьё '+randomUUID());
  await page.getByRole('button',{name:'Создать категорию'}).click();
  await expect(page.getByRole('listitem').filter({hasText:'Овощное сырьё'})).toHaveCount(1);
  await page.getByRole('button',{name:'Поставщики',exact:true}).click();
  await expect(page.getByRole('heading',{name:company,exact:true})).toBeVisible();
});
