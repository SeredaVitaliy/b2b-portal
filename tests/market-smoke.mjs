import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyMarket(base,request=fetch) {
  let cookie='';
  async function call(path,body) {
    const headers={'Content-Type':'application/json',cookie};
    const url=new URL('/api/market/'+path,base);
    const response=await request(new Request(url,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}));
    assert.equal(response.status,200, path+' returned '+response.status);
    const next=response.headers.get('set-cookie');
    if(next) cookie=next.split(';')[0];
    return response.json();
  }
  const guest=await call('market');
  assert.ok(guest.products.length>=320 && guest.offers.every(o=>o.price===null));
  await call('login',{role:'buyer'});
  const data=await call('market');
  const selected=[];
  for(const company of data.companies) {
    const offer=data.offers.find(o=>o.supplier===company.id && o.price>0 && o.stock>=Math.ceil(company.minimum/o.price/o.pack)*o.pack);
    if(!offer) continue;
    selected.push({id:offer.id,price:offer.price,quantity:Math.max(offer.pack,Math.ceil(company.minimum/offer.price/offer.pack)*offer.pack),supplier:company.id});
    if(selected.length===2) break;
  }
  assert.equal(selected.length,2);
  const key=randomUUID(),delivery=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
  const order={key,address:'Калининград, тестовый адрес',note:'Проверка '+key,dates:Object.fromEntries(selected.map(o=>[o.supplier,delivery])),lines:selected};
  await call('checkout',order);
  try {
    await call('checkout',order);
    const orders=(await call('market')).orders.filter(o=>o.checkout===key);
    assert.equal(orders.length,2);
    assert.equal(new Set(orders.map(o=>o.supplier)).size,2);
    await call('login',{role:'supplier'});
    const supplier=await call('market');
    assert.ok(supplier.orders.every(o=>o.supplier===supplier.user.company));
    assert.ok(supplier.orders.some(o=>o.checkout===key));
    await call('login',{role:'platform'});
    assert.equal((await call('market')).orders.filter(o=>o.checkout===key).length,2);
  } finally {
    await call('login',{role:'buyer'});
    for(const o of (await call('market')).orders.filter(o=>o.checkout===key && o.status==='new')) await call('status',{id:o.id,status:'cancelled'});
    await call('logout',{});
  }
}
if(process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  await verifyMarket(process.argv[2]); console.log('Проверены каталог, оформление, повтор запроса, три роли и отмена.');
}
