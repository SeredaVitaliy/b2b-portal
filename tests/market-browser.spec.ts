import {randomUUID} from 'node:crypto';
import {expect, test} from '@playwright/test';
import {money, type Market} from '../client/src/market/types';

test('гость сравнивает предложения, закупщик оформляет корзину, поставщик подтверждает заказ', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Каталог продуктов'})).toBeVisible();
  await expect(page.getByRole('link', {name: /Цена после входа/}).first()).toBeVisible();
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
  const card = page.getByRole('link').filter({has: page.getByRole('heading', {name: product.name, exact: true})});
  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => card.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const imagePath = await card.locator('img').getAttribute('src');
  expect(imagePath).toMatch(/^\/ingredients\//);
  await card.click();
  await expect(page).toHaveURL(new RegExp('/products/'+product.id+'$'));
  await expect(page.getByRole('heading', {name: product.name, exact: true, level: 1})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name: product.name, exact: true, level: 1})).toBeVisible();
  const productPhoto = page.getByRole('img', {name: product.name, exact: true});
  await expect(productPhoto).toHaveAttribute('src', imagePath!);
  await expect.poll(() => productPhoto.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const details = page.getByRole('main');
  for (const offer of selected) {
    const company = catalog.companies.find(item => item.id === offer.supplier)!;
    const row = details.getByRole('article').filter({hasText: company.name});
    await expect(row.locator('strong')).toHaveText(money(offer.price!));
    await row.getByRole('button', {name: 'В корзину'}).click();
  }
  await page.getByRole('navigation',{name:'Навигация по каталогу'}).getByRole('link',{name:'Каталог'}).click();
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

  async function importCsv(name:string,content:string) {
    const opened=page.waitForEvent('filechooser');
    await page.getByRole('button',{name:'Импорт CSV'}).click();
    await (await opened).setFiles({name,mimeType:'text/csv',buffer:Buffer.from(content)});
  }
  await importCsv('import.csv','id,price,stock\n'+owned.map(offer=>[offer.id,offer.price!+5,offer.stock+2].join(',')).join('\n'));
  const saved = page.waitForResponse(response=>response.url().endsWith('/offers-batch'));
  await page.getByRole('button', {name: /Сохранить изменения.*2/}).click();
  expect((await saved).status()).toBe(200);
  const after: Market = await (await page.request.get('/api/market/market')).json();
  expect(after.history.some(entry=>entry.price_after===owned[0].price!+5 && entry.stock_after===owned[0].stock+2)).toBe(true);
  for (const offer of owned) {
    expect(after.offers.find(item=>item.id===offer.id)).toMatchObject({price:offer.price!+5,stock:offer.stock+2});
  }

  const offer=owned[0];
  await importCsv('prices.csv','sku,price\n'+offer.sku+','+(offer.price!+9));
  const savePrices=page.getByRole('button',{name:'Сохранить изменения · 1'});
  await expect(savePrices).toBeEnabled();
  const stockChange=await page.request.post('/api/market/offers-batch',{data:{rows:[{id:offer.id,stock:offer.stock+3}]}});
  expect(stockChange.ok()).toBe(true);
  const priceChange=page.waitForResponse(response=>response.url().endsWith('/offers-batch'));
  await savePrices.click();
  expect((await priceChange).ok()).toBe(true);
  const current:Market=await (await page.request.get('/api/market/market')).json();
  expect(current.offers.find(item=>item.id===offer.id)).toMatchObject({price:offer.price!+9,stock:offer.stock+3});
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
  await page.getByRole('textbox',{name:'Юридическое название'}).fill('ООО Демо');
  await page.getByRole('textbox',{name:'ИНН'}).fill('0123456789');
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

test('менеджер видит аналитику и может отозвать доступ сотрудника заведения', async ({page, browser}) => {
  const post = (action: string, data: object) => page.request.post('/api/market/'+action, {data});
  expect((await post('login', {role: 'platform'})).status()).toBe(200);
  const overview: Market = await (await page.request.get('/api/market/market')).json();
  const company = overview.companies.find(item => item.kind==='buyer' && item.active && item.id!==9)!;
  const email = `${randomUUID()}@example.test`, code = randomUUID();
  expect((await post('member', {company:company.id, name:'Демо сотрудник', email, code, role:'buyer'})).status()).toBe(200);
  await page.goto('/workspace');
  await expect(page.getByRole('heading', {name:'Аналитика площадки'})).toBeVisible();
  await expect(page.getByText('Оборот доставленных заказов')).toBeVisible();

  const staff = await browser.newContext({baseURL:'http://127.0.0.1:4175'});
  try {
    const login = () => staff.request.post('/api/market/login', {data:{email,code}});
    expect((await login()).status()).toBe(200);
    const employee: Market = await (await staff.request.get('/api/market/market')).json();
    expect(employee.user).toMatchObject({role:'buyer',company:company.id});
    expect(employee.orders.length).toBeGreaterThan(0);
    expect(employee.orders.every(order=>order.buyer===company.id)).toBe(true);
    expect(employee.analytics).toBeNull();
    expect(employee.members).toEqual([]);
    expect((await post('member', {id:employee.user?.member,company:company.id,role:'buyer',active:false})).status()).toBe(200);
    expect((await (await staff.request.get('/api/market/market')).json()).user).toBeNull();
    expect((await login()).status()).toBe(401);
  } finally {
    await staff.close();
  }
});

test('остаток одного поставщика автоматически меняется в открытой витрине и корзине', async ({page, browser}) => {
  const supplier = await browser.newContext({baseURL:'http://127.0.0.1:4175'});
  try {
    expect((await supplier.request.post('/api/market/login',{data:{role:'supplier'}})).ok()).toBe(true);
    expect((await page.request.post('/api/market/login',{data:{role:'buyer'}})).ok()).toBe(true);
    const catalog:Market=await (await page.request.get('/api/market/market')).json();
    const company=catalog.companies.find(item=>item.id===1)!;
    const enough=(offer:Market['offers'][number])=>offer.pack+Math.max(0,
      Math.ceil((company.minimum/offer.price!-offer.pack)/(offer.step??offer.pack)))*(offer.step??offer.pack);
    const owned=catalog.offers.find(offer=>offer.supplier===1 && !!offer.price && offer.stock>=enough(offer) &&
      new Set(catalog.offers.filter(other=>other.product===offer.product).map(other=>other.stock)).size===3)!;
    expect(owned).toBeDefined();
    const other=catalog.offers.find(offer=>offer.product===owned.product && offer.supplier!==owned.supplier)!;
    const name=(id:number)=>catalog.companies.find(company=>company.id===id)!.name;
    await page.goto('/products/'+owned.product);
    const offerRow=(id:number)=>page.getByRole('main').getByRole('article').filter({
      has:page.getByRole('heading',{name:name(id),exact:true}),
    });
    await expect(offerRow(owned.supplier).getByText('В наличии '+owned.stock+' уп.',{exact:true})).toBeVisible();
    await expect(offerRow(other.supplier).getByText('В наличии '+other.stock+' уп.',{exact:true})).toBeVisible();
    await offerRow(owned.supplier).getByRole('button',{name:'В корзину'}).click();
    await page.getByRole('button',{name:'Открыть корзину'}).click();
    const quantity=page.getByRole('dialog').getByRole('spinbutton',{name:'Количество'});
    await quantity.fill(String(enough(owned)));
    await quantity.press('Tab');
    const checkout=page.getByRole('dialog').getByRole('button',{name:/Оформить/});
    await expect(checkout).toBeEnabled();

    expect((await supplier.request.post('/api/market/offers-batch',{data:{rows:[{id:owned.id,stock:0}]}})).ok()).toBe(true);
    await expect(checkout).toBeDisabled({timeout:7500});
    await page.getByRole('dialog').getByRole('button',{name:'Close'}).click();
    await expect(offerRow(owned.supplier).getByText('Нет в наличии',{exact:true})).toBeVisible();
    await expect(offerRow(other.supplier).getByText('В наличии '+other.stock+' уп.',{exact:true})).toBeVisible();
  } finally {
    await supplier.close();
  }
});

test('поставщик вставляет строки Excel, заливает диапазон цен и сохраняет изменения', async ({page}) => {
  expect((await page.request.post('/api/market/login',{data:{role:'supplier'}})).ok()).toBe(true);
  const catalog:Market=await (await page.request.get('/api/market/market')).json();
  const owned=catalog.offers.filter(offer=>offer.supplier===1).sort((a,b)=>a.id-b.id).slice(0,2);
  const name=(offer:typeof owned[number])=>catalog.products.find(product=>product.id===offer.product)!.name;
  const field=(label:string,index:number)=>page.getByRole('spinbutton',{name:label+' · '+name(owned[index]),exact:true});
  await page.goto('/workspace');
  await expect(page.getByRole('heading',{name:'Редактор цен и остатков'})).toBeVisible();
  await field('Цена',0).evaluate(input=>{
    const data=new DataTransfer();
    data.setData('text/plain','701\t31\n702\t42');
    input.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  });
  await expect(field('Остаток',0)).toHaveValue('31');
  await expect(field('Остаток',1)).toHaveValue('42');
  await field('Цена',0).click();
  await field('Цена',1).click({modifiers:['Shift']});
  await page.getByRole('spinbutton',{name:'Значение заливки'}).fill('850');
  await page.getByRole('button',{name:'Применить к выделенным (2)'}).click();
  await expect(field('Цена',0)).toHaveValue('850');
  await expect(field('Цена',1)).toHaveValue('850');
  const saved=page.waitForResponse(response=>response.url().endsWith('/offers-batch'));
  await page.getByRole('button',{name:'Сохранить изменения · 2'}).click();
  expect((await saved).ok()).toBe(true);
  const after:Market=await (await page.request.get('/api/market/market')).json();
  expect(after.offers.find(offer=>offer.id===owned[0].id)).toMatchObject({price:850,stock:31});
  expect(after.offers.find(offer=>offer.id===owned[1].id)).toMatchObject({price:850,stock:42});
});

test('каталог показывает все карточки одной страницей и ищет по артикулу', async ({page}) => {
  await page.goto('/catalog');
  await expect(page.getByRole('link',{name:/Цена после входа/})).toHaveCount(24);
  await page.getByRole('checkbox',{name:'Показать все товары'}).check();
  const catalog:Market=await (await page.request.get('/api/market/market')).json();
  const publicProducts=new Set(catalog.offers.map(offer=>offer.product));
  await expect(page.getByRole('link',{name:/Цена после входа/})).toHaveCount(publicProducts.size);
  const sku=catalog.offers.find(offer=>offer.sku?.startsWith('SV-') && offer.id>=100)!.sku!;
  await page.getByRole('textbox',{name:'Поиск'}).fill(sku.toLowerCase() + ' ');
  const matches=new Set(catalog.offers.filter(offer=>offer.sku?.toLowerCase().includes(sku.toLowerCase())).map(offer=>offer.product));
  await expect(page.getByRole('link',{name:/Цена после входа/})).toHaveCount(matches.size);
});
