import { useEffect,useRef,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Button,Drawer,Modal,Select,Input,InputNumber,Empty,Alert,ConfigProvider,Pagination,Progress } from 'antd';
import { ShopOutlined,ShoppingOutlined,SearchOutlined,EnvironmentOutlined,ArrowRightOutlined } from '@ant-design/icons';
import {api,money,orderQuantity,roles,statuses,weekdays} from './types';
import type {Market,Product,Offer,Company,Template} from './types';
import {Workspace} from './Workspace';
import {Enrollment,OrderDiscussion} from './Operations';
import {Link,useMatch,useNavigate} from 'react-router-dom';
import {ProductDetails} from './ProductDetails';
import {ProductImage} from './ProductImage';
import {BuyerTools} from './BuyerTools';
import './market.css';

type Cart=Record<number,number>;
const storageKey='sv-market-cart-v1';
function savedCart():Cart{
 try {const value=JSON.parse(localStorage.getItem(storageKey)||'{}');return Object.fromEntries(Object.entries(value).filter(([k,v])=>Number(k)>0&&typeof v==='number'&&Number.isSafeInteger(v)&&v>0)) as Cart;}catch{return {};}
}
function dateAfter(days:number){
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Kaliningrad'}).format(new Date());
 const date=new Date(today+'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);
}
function dateOptions(company:Company) {
 return Array.from({length:61-company.lead_days},(_,index)=>dateAfter(company.lead_days+index))
  .filter(date=>company.delivery_days.includes(new Date(date+'T12:00:00Z').getUTCDay()||7))
  .map(value=>({value,label:new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'))}));
}
export default function App(){
 const cache=useQueryClient();
 const query=useQuery({queryKey:['market'],queryFn:()=>api<Market>('market'),retry:1,refetchInterval:15000});
 const inventory=useQuery({
  queryKey:['market-inventory-version'],
  queryFn:()=>api<{version:string}>('inventory-version'),
  enabled:!!query.data?.inventoryVersion,
  refetchInterval:2000,
  retry:false,
 });
 useEffect(()=>{
  if(inventory.data && inventory.dataUpdatedAt>query.dataUpdatedAt &&
     inventory.data.version!==query.data?.inventoryVersion) {
   void cache.invalidateQueries({queryKey:['market']});
  }
 },[cache,inventory.data,inventory.dataUpdatedAt,query.data?.inventoryVersion,query.dataUpdatedAt]);
 useEffect(()=>{
  if(!import.meta.env.DEV)return;
  const url=new URL('/api/market/updates',window.location.origin);
  url.protocol=url.protocol==='https:'?'wss:':'ws:';
  const socket=new WebSocket(url);
  socket.onmessage=event=>{
    if(event.data==='catalog-updated')void cache.invalidateQueries({queryKey:['market']});
  };
  return ()=>socket.close();
 },[cache]);
 const d=query.data, role=d?.user?.role||'', buyer=role.startsWith('buyer');
 const navigate=useNavigate();
 const pluralProductRoute=useMatch('/products/:id');
 const singularProductRoute=useMatch('/product/:id');
 const catalogProductRoute=useMatch('/catalog/:id');
 const productRoute=pluralProductRoute??singularProductRoute??catalogProductRoute;
 const supplierRoute=useMatch('/suppliers/:id');
 const orderRoute=useMatch('/orders/:id');
 const productId=Number(productRoute?.params.id);
 const product=d?.products.find(item=>item.id===productId&&item.approved);
 const routeNames:Record<string,string>={'/catalog':'Каталог','/suppliers':'Поставщики','/orders':'Заказы','/purchases':'Закупки','/workspace':'Кабинет'};
 const exactRoute=useMatch('*')?.pathname??'/';
 const view=productRoute?'Товар':supplierRoute?'Поставщик':orderRoute?'Заказы':routeNames[exactRoute]??'Каталог';
 function setView(name:string) {navigate(Object.keys(routeNames).find(route=>routeNames[route]===name)??'/catalog');}
 const [search,setSearch]=useState(''),[cat,setCat]=useState(0),[supplier,setSupplier]=useState(0),[page,setPage]=useState(1),[sort,setSort]=useState('catalog'),[stock,setStock]=useState(false);
 const [enrollment,setEnrollment]=useState(false);
 const [login,setLogin]=useState(false),[basket,setBasket]=useState(false),[cart,setCart]=useState<Cart>(savedCart);
 const [employeeEmail,setEmployeeEmail]=useState(''),[employeeCode,setEmployeeCode]=useState('');
 const [catalogMode,setCatalogMode]=useState<'products'|'suppliers'>('products');
 const [showAll,setShowAll]=useState(false);
 const [address,setAddress]=useState('Калининград, ресторан «Порт»'),[note,setNote]=useState(''),[dates,setDates]=useState<Record<number,string>>({});
 const [template,setTemplate]=useState<Template['lines']|null>(null),[templateName,setTemplateName]=useState('');
 const [favoritesOnly,setFavoritesOnly]=useState(false),[tomorrow,setTomorrow]=useState(false);
 const [minPrice,setMinPrice]=useState<number|null>(null),[maxPrice,setMaxPrice]=useState<number|null>(null);
 const [orderStatus,setOrderStatus]=useState('all'),[orderSearch,setOrderSearch]=useState(''),[orderFrom,setOrderFrom]=useState(''),[orderTo,setOrderTo]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const checkoutKey=useRef(crypto.randomUUID()),lock=useRef(false);
 useEffect(()=>{localStorage.setItem(storageKey,JSON.stringify(cart));checkoutKey.current=crypto.randomUUID();},[cart,address,note,dates]);
 useEffect(()=>{setPage(1);},[search,cat,supplier,stock,sort,favoritesOnly,tomorrow,minPrice,maxPrice]);
 async function act(path:string,data:unknown,done?:()=>void){
  if(lock.current)return; lock.current=true;setBusy(true);setError('');setNotice('');
  try {await api(path,data);done?.();await cache.invalidateQueries({queryKey:['market']});}
  catch(e){setError(e instanceof Error?e.message:'Ошибка запроса');await query.refetch();}
  finally{lock.current=false;setBusy(false);}
 }
 const name=(id:number)=>d?.companies.find(c=>c.id===id)?.name||'Компания №'+id;
 const byProduct=new Map<number,Offer[]>();
 for(const o of d?.offers||[]) {const offers=byProduct.get(o.product)||[];offers.push(o);byProduct.set(o.product,offers);}
 const purchases=new Map<number,{count:number;latest:string}>();
 const offerProducts=new Map(d?.offers.map(offer=>[offer.id,offer.product]));
 if(buyer)for (const order of d?.orders||[]) {
  if(order.status!=='delivered')continue;
  for (const id of new Set(order.items.map(item=>offerProducts.get(item.offer)))) {
   if(id===undefined)continue;
   const previous=purchases.get(id);
   purchases.set(id,{count:(previous?.count??0)+1,latest:previous&&previous.latest>order.delivery?previous.latest:order.delivery});
  }
 }
 const companies=new Map(d?.companies.map(company=>[company.id,company]));
 const nextDay=dateAfter(1),nextWeekday=new Date(nextDay+'T12:00:00Z').getUTCDay()||7;
 const searchKey=(value:string)=>value.trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
 const term=searchKey(search);
 const matching=(p:Product)=>(byProduct.get(p.id)||[]).filter(o=>{
   const company=companies.get(o.supplier);
   return o.active!==false&&company?.active&&(!supplier||o.supplier===supplier)&&(!stock||o.stock>=o.pack)&&
     (searchKey(p.name).includes(term)||searchKey(o.sku??'').includes(term))&&
     (!minPrice||o.price===null||o.price>=minPrice)&&(!maxPrice||o.price===null||o.price<=maxPrice)&&
     (!tomorrow||(company.lead_days===1&&company.delivery_days.includes(nextWeekday)));
 });
 const includedCategories=new Set([cat]);
 for (const category of d?.categories||[]) {
  if(category.parent!==null&&includedCategories.has(category.parent))includedCategories.add(category.id);
 }
 const filtered=(d?.products||[]).filter(p=>p.approved&&(!favoritesOnly||d?.favorites?.includes(p.id))&&(!cat||includedCategories.has(p.category))&&matching(p).length);
 if(sort==='frequency')filtered.sort((a,b)=>(purchases.get(b.id)?.count??0)-(purchases.get(a.id)?.count??0));
 if(sort==='price')filtered.sort((a,b)=>(matching(a)[0].price||0)-(matching(b)[0].price||0));
 if(sort==='price-desc')filtered.sort((a,b)=>(matching(b)[0].price||0)-(matching(a)[0].price||0));
 const frequent=filtered.filter(item=>(purchases.get(item.id)?.count??0)>1)
  .sort((a,b)=>(purchases.get(b.id)?.count??0)-(purchases.get(a.id)?.count??0)).slice(0,4);
 const lastMonth=dateAfter(-30);
 const previouslyOrdered=filtered.filter(item=>{
  const itemHistory=purchases.get(item.id);
  return itemHistory&&itemHistory.latest<=lastMonth;
 }).slice(0,4);
 const suppliers=(d?.companies||[]).filter(c=>c.active&&c.kind==='supplier');
 const lines=(d?.offers||[]).filter(o=>cart[o.id]>0&&o.active!==false&&companies.get(o.supplier)?.active);
 const unavailableCartIds=query.isSuccess?Object.keys(cart).map(Number).filter(id=>!lines.some(item=>item.id===id)):[];
 const invalidQuantities=lines.some(offer=>!orderQuantity(offer,cart[offer.id]));
 const groups=[...new Set(lines.map(o=>o.supplier))];
 const availableDates=Object.fromEntries(suppliers.filter(item=>groups.includes(item.id)).map(item=>[item.id,dateOptions(item)]));
 const chosenDate=(id:number)=>availableDates[id]?.find(date=>date.value===dates[id])?.value||availableDates[id]?.[0]?.value;
 const visibleOrders=(d?.orders||[]).filter(order=>{
  if(orderRoute)return order.id===Number(orderRoute.params.id);
  const term=orderSearch.trim().toLowerCase();
  return (orderStatus==='all'||order.status===orderStatus)&&(!orderFrom||order.delivery>=orderFrom)&&(!orderTo||order.delivery<=orderTo)&&
    (!term||String(order.id).includes(term)||order.items.some(item=>item.name.toLowerCase().includes(term)));
 });
 const selectedProductOffers=(product?byProduct.get(product.id)||[]:[]).filter(offer=>offer.active!==false&&companies.get(offer.supplier)?.active);
 const sum=(rows:Offer[])=>rows.reduce((n,o)=>n+(o.price||0)*cart[o.id],0);
 const setQuantity=(id:number,n:number)=>setCart(prev=>{const next={...prev};if(n)next[id]=n;else delete next[id];return next;});
 function startTemplate(items:Template['lines']){setTemplateName('');setTemplate(items);}
 function loadLines(items:Template['lines']){
  const activeIds=new Set(d?.offers.filter(offer=>offer.active!==false&&companies.get(offer.supplier)?.active).map(offer=>offer.id));
  const available=items.filter(item=>activeIds.has(item.id));
  setCart(previous=>({...previous,...Object.fromEntries(available.map(item=>[item.id,item.quantity]))}));
  if(available.length!==items.length)setNotice('Часть предложений больше недоступна.');
  setBasket(true);
 }
 function changeRole(credentials:{role:string}|{email:string;code:string}|null){
  void act(credentials?'login':'logout',credentials??{},()=>{
   setLogin(false);setBasket(false);setEmployeeCode('');
   if(role)setView('Каталог');
   setFavoritesOnly(false);setMaxPrice(null);
  });
 }
 return <ConfigProvider theme={{token:{colorPrimary:'#215743',borderRadius:8,fontFamily:'Inter, Arial, sans-serif'}}}>
 <header><div className="brand"><i>SV</i><span>маркет</span></div><nav>{['Каталог','Поставщики',...(role?['Заказы']:[]),...(buyer?['Закупки']:[]),...(role&&!buyer?['Кабинет']:[])].map(v=><button className={view===v||(productRoute&&v==='Каталог')||(supplierRoute&&v==='Поставщики')?'active':''} onClick={()=>setView(v)} key={v}>{v}</button>)}</nav><div className="actions"><Button onClick={()=>setLogin(true)}>{roles[role]||'Демо-вход'}</Button><Button aria-label="Открыть корзину" icon={<ShoppingOutlined/>} onClick={()=>buyer?setBasket(true):setLogin(true)}>{Object.keys(cart).length}</Button></div></header>
 <main>{(error||query.error)&&<Alert type="error" showIcon message={error||query.error?.message} action={<Button onClick={()=>{setError('');void query.refetch();}}>Обновить</Button>}/>}
 {notice&&<Alert type="success" showIcon message={notice} closable onClose={()=>setNotice('')}/>}
 {view==='Каталог'&&<><section className="hero">
   <div className="hero-copy">
    <small><EnvironmentOutlined/> Калининградская область</small>
    <h1>Рынок для<br/>ресторанов.</h1>
    <p>Сравнивайте предложения местных поставщиков и оформляйте закупки для всей кухни одной корзиной.</p>
    <a className="hero-link" href="#catalog">К каталогу <ArrowRightOutlined/></a>
   </div>
   <div className="hero-photo" aria-hidden="true"/>
 </section>
 {view==='Каталог'&&buyer&&!search&&!cat&&!supplier&&<div className="report-columns">
  {[{title:'Часто заказываете',products:frequent},{title:'Давно не заказывали',products:previouslyOrdered}].map(({title,products})=>products.length>0&&<article key={title}>
   <h3>{title}</h3>{products.map(item=><p key={item.id}><Link to={'/products/'+item.id}>{item.name}</Link></p>)}
  </article>)}
 </div>}
 <section id="catalog"><div className="heading"><h2>Каталог продуктов</h2><Input prefix={<SearchOutlined/>} allowClear placeholder="Найти продукт" aria-label="Поиск" value={search} onChange={e=>setSearch(e.target.value)}/></div>
 <div className="chips">{[{id:0,name:'Все категории'},...(d?.categories||[])].map(c=><button key={c.id} className={cat===c.id?'on':''} onClick={()=>setCat(c.id)}>{c.name}</button>)}</div>
 <div className="filters"><Select aria-label="Поставщик" value={supplier} onChange={setSupplier} options={[{value:0,label:'Все поставщики'},...suppliers.map(c=>({value:c.id,label:c.name}))]}/><label><input type="checkbox" checked={stock} onChange={e=>setStock(e.target.checked)}/> В наличии</label><label><input type="checkbox" checked={tomorrow} onChange={e=>setTomorrow(e.target.checked)}/> Доставят завтра</label>{buyer&&<label><input type="checkbox" checked={favoritesOnly} onChange={e=>setFavoritesOnly(e.target.checked)}/> Избранное</label>}{role&&<><InputNumber aria-label="Цена от" placeholder="Цена от, ₽" min={1} value={minPrice} onChange={setMinPrice}/><InputNumber aria-label="Цена до" placeholder="Цена до, ₽" min={1} value={maxPrice} onChange={setMaxPrice}/></>}{role&&<Select aria-label="Сортировка" value={sort} onChange={setSort} options={[{value:'catalog',label:'По каталогу'},{value:'price',label:'Сначала дешевле'},{value:'price-desc',label:'Сначала дороже'},...(buyer?[{value:'frequency',label:'Сначала часто заказываемые'}]:[])]}/>}
 <Select aria-label="Группировка каталога" value={catalogMode} onChange={setCatalogMode} options={[{label:'По товарам',value:'products'},{label:'По поставщикам',value:'suppliers'}]}/>{catalogMode==='products'&&<label><input type="checkbox" checked={showAll} onChange={event=>setShowAll(event.target.checked)}/> Показать все товары</label>}<span>{filtered.length} позиций</span></div>
 {catalogMode==='products'?<>
 <div className="grid">{(showAll?filtered:filtered.slice((page-1)*24,page*24)).map(p=>{const os=matching(p);return <Link className="card" key={p.id} to={"/products/"+p.id}><ProductImage product={p}/><div className="info"><small>{d?.categories.find(c=>c.id===p.category)?.name}</small><h3>{p.name}</h3><strong>{role?'от '+money(os[0].price||0):'Цена после входа'}</strong><footer>{os.length===1?'1 поставщик':os.length+' поставщика'} <ArrowRightOutlined/></footer></div></Link>;})}</div>
 {!showAll&&Boolean(filtered.length)&&<Pagination current={page} pageSize={24} total={filtered.length} onChange={setPage} showSizeChanger={false}/>}
 </>:<div className="grid">{suppliers.map(company=>{
   const count=filtered.filter(item=>matching(item).some(offer=>offer.supplier===company.id)).length;
   if(!count)return null;
   return <article key={company.id}><h3><Link to={'/suppliers/'+company.id}>{company.name}</Link></h3><p>Найдено позиций: {count}</p>
    <Button onClick={()=>{setSupplier(company.id);setCatalogMode('products');}}>Показать товары</Button></article>;
 })}</div>}
 {!filtered.length&&<Empty description={query.isLoading?'Загружаем каталог…':'Товары не найдены'}/>}</section></>}
 {view==='Поставщики'&&<section><div className="heading"><h1>Поставщики</h1><Button onClick={()=>setEnrollment(true)}>Подать заявку</Button></div><div className="grid">{suppliers.map(c=><Link className="supplier" key={c.id} to={"/suppliers/"+c.id}><ShopOutlined/><h3>{c.name}</h3><p>{c.description||'Поставки для заведений Калининградской области'}</p><p>{c.delivery_days.map(day=>weekdays[day-1]).join(', ')} · от {c.lead_days} дн.</p><strong>Заказ от {money(c.minimum)}</strong></Link>)}</div></section>}
 {d&&view==='Кабинет'&&(role==='platform'||role.startsWith('supplier')?<Workspace d={d} act={act} busy={busy}/>:<Empty description="Кабинет доступен поставщикам и менеджеру портала"/>)}
 {d&&view==='Закупки'&&<BuyerTools market={d} {...{act,busy}} load={loadLines}/>}
 {d&&view==='Заказы'&&<section>{orderRoute?<Link to="/orders">Все заказы</Link>:<div className="heading"><h1>Заказы</h1><Select aria-label="Статус заказа" value={orderStatus} onChange={setOrderStatus} options={[{value:'all',label:'Все статусы'},...Object.entries(statuses).map(([value,label])=>({value,label}))]}/></div>}
 {!orderRoute&&<div className="filters"><Input aria-label="Поиск заказов" placeholder="Номер заказа или товар" value={orderSearch} onChange={event=>setOrderSearch(event.target.value)}/><label>Доставка с <input type="date" value={orderFrom} onChange={event=>setOrderFrom(event.target.value)}/></label><label>по <input type="date" min={orderFrom||undefined} value={orderTo} onChange={event=>setOrderTo(event.target.value)}/></label></div>}
 {!visibleOrders.length&&<Empty description={orderRoute?'Заказ не найден':'Заказы не найдены'}/>}
 {visibleOrders.map(o=><article key={o.id}><div className="row">{orderRoute?<h1>Заказ №{o.id} · {name(o.supplier)}</h1>:<h3><Link to={"/orders/"+o.id}>Заказ №{o.id} · {name(o.supplier)}</Link></h3>}<b>{statuses[o.status]}</b></div><p>{o.address} · {o.delivery} · {o.note}</p>{o.items.map(i=><p key={i.offer}>{i.name} × {i.quantity} · {money(i.price*i.quantity)}</p>)}<small>{o.events.map(e=>statuses[e.status]).join(' → ')}</small><OrderDiscussion key={o.id} order={o} {...{act,busy}}/><div className="filters">{buyer&&<Button onClick={()=>{loadLines(o.items.map(i=>({id:i.offer,quantity:i.quantity})));}}>Повторить заказ</Button>}{buyer&&<Button onClick={()=>startTemplate(o.items.map(i=>({id:i.offer,quantity:i.quantity})))}>Сохранить как шаблон</Button>}{(buyer&&o.status==='new'?['cancelled']:role.startsWith('supplier')?({new:['confirmed'],confirmed:['packing','dispute'],packing:['shipping','dispute'],shipping:['delivered','dispute'],delivered:['dispute']} as Record<string,string[]>)[o.status]||[]:role==='platform'&&o.status==='dispute'?['delivered','cancelled']:buyer&&['confirmed','packing','shipping','delivered'].includes(o.status)?['dispute']:[]).map(s=><Button disabled={busy} key={s} onClick={()=>void act('status',{id:o.id,status:s})}>{statuses[s]}</Button>)}</div></article>)}</section>}
 {productRoute&&product&&<ProductDetails key={product.id} product={product} category={d?.categories.find(item=>item.id===product.category)?.name||'Товары'}
  offers={selectedProductOffers} companies={companies} signedIn={!!role} {...{buyer,cart}} favorite={!!d?.favorites.includes(product.id)}
  onFavorite={()=>void act('favorite',{id:product.id,active:!d?.favorites.includes(product.id)})}
  onAdd={(id,quantity)=>setCart(previous=>({...previous,[id]:(previous[id]||0)+quantity}))} onLogin={()=>setLogin(true)}/>}
 {productRoute&&!product&&<Empty description={query.isLoading?'Загружаем товар…':'Товар не найден'}><Link to="/catalog">В каталог</Link></Empty>}
 {supplierRoute&&(()=>{const company=suppliers.find(item=>item.id===Number(supplierRoute.params.id));
  if(!company)return <Empty description={query.isLoading?'Загружаем поставщика…':'Поставщик не найден'}><Link to="/suppliers">Все поставщики</Link></Empty>;
  const available=new Set(d?.offers.filter(offer=>offer.supplier===company.id&&offer.active!==false).map(offer=>offer.product));
  const assortment=d?.products.filter(item=>item.approved&&available.has(item.id))||[];
  return <section><Link to="/suppliers">Все поставщики</Link><h1>{company.name}</h1><p>{company.description||'Поставщик для заведений Калининграда'}</p>
   <p>Доставка от {company.lead_days} дн. · {company.delivery_days.map(day=>weekdays[day-1]).join(', ')} · заказ от {money(company.minimum)}</p>
   {company.delivery_area&&<p>Зоны доставки: {company.delivery_area}</p>}
   <div className="heading"><h2>Ассортимент</h2><Button onClick={()=>{setSupplier(company.id);setCat(0);setSearch('');setPage(1);setCatalogMode('products');setView('Каталог');}}>С фильтрами каталога</Button></div>
   {assortment.length?<div className="grid">{assortment.map(item=><Link key={item.id} className="card" to={'/products/'+item.id}><ProductImage product={item}/><div className="info"><h3>{item.name}</h3></div></Link>)}</div>:<Empty description="Поставщик ещё не опубликовал ассортимент"/>}
  </section>;
 })()}
 </main><div className="bottom">SV маркет <span>Оптовые закупки · Калининград</span></div>
 <Modal open={login} onCancel={()=>setLogin(false)} title="Войти в демо" footer={null}>
  {error&&<Alert type="error" message={error}/>}
  <div className="rolelist">{Object.entries(roles).map(([r,n])=><Button disabled={busy} key={r} onClick={()=>changeRole({role:r})}>{n}</Button>)}{role&&<Button onClick={()=>changeRole(null)}>Выйти</Button>}</div>
  <details><summary>Вход сотрудника по коду</summary>
   <form className="filters" onSubmit={event=>{event.preventDefault();changeRole({email:employeeEmail,code:employeeCode});}}>
    <Input aria-label="Рабочая почта" placeholder="Рабочая почта" type="email" value={employeeEmail} required onChange={event=>setEmployeeEmail(event.target.value)}/>
    <Input.Password aria-label="Код доступа" placeholder="Код доступа" value={employeeCode} required onChange={event=>setEmployeeCode(event.target.value)}/>
    <Button htmlType="submit" disabled={busy}>Войти по коду</Button>
   </form>
  </details>
 </Modal>
 <Enrollment open={enrollment} onClose={()=>setEnrollment(false)} {...{act,busy}}/>
 <Modal open={!!template} title="Шаблон закупки" onCancel={()=>setTemplate(null)} onOk={()=>void act('template',{name:templateName,lines:template},()=>{setTemplate(null);setNotice('Шаблон сохранён');})} okText="Сохранить шаблон" cancelText="Отмена" okButtonProps={{disabled:!templateName.trim(),loading:busy}}>
  <Input aria-label="Название шаблона" value={templateName} maxLength={100} onChange={event=>setTemplateName(event.target.value)}/>
 </Modal>
 <Drawer open={basket} onClose={()=>setBasket(false)} title="Корзина" size={510}>{error&&<Alert type="error" message={error}/>}
 {unavailableCartIds.length>0&&<Alert type="warning" message="Есть недоступные предложения" action={<Button onClick={()=>setCart(previous=>Object.fromEntries(Object.entries(previous).filter(([id])=>!unavailableCartIds.includes(Number(id)))))}>Удалить</Button>}/>}
 {invalidQuantities&&<Alert type="warning" message="Уточните количество с учётом остатка, партии и шага"/>}
 {!lines.length?<Empty description="Корзина пуста"/>:<>{groups.map(id=>{const c=suppliers.find(x=>x.id===id)!;const rows=lines.filter(o=>o.supplier===id);const subtotal=sum(rows);return <article key={id}><h3>{c.name}</h3>{rows.map(o=><div className="cartrow" key={o.id}><span>{d?.products.find(p=>p.id===o.product)?.name}</span><InputNumber aria-label="Количество" min={0} max={o.stock} precision={0} step={o.step??o.pack} status={orderQuantity(o,cart[o.id])?undefined:'error'} value={cart[o.id]} onChange={n=>setQuantity(o.id,n||0)}/><b>{money((o.price||0)*cart[o.id])}</b></div>)}<p>{subtotal<c.minimum?'До минимального заказа '+money(c.minimum-subtotal):'Минимальная сумма набрана'}</p>{c.minimum>0&&<Progress percent={Math.min(100,Math.floor(subtotal/c.minimum*100))} showInfo={false}/>}<label>Дата доставки <Select aria-label={"Дата доставки "+c.name} options={availableDates[id]} value={chosenDate(id)} onChange={value=>setDates({...dates,[id]:value})}/></label></article>;})}
 {Boolean(d?.addresses?.length)&&<Select aria-label="Сохранённый адрес" placeholder="Сохранённые адреса" onChange={setAddress} options={d?.addresses.map(item=>({value:item.address,label:item.address}))}/>}
 <label>Адрес доставки<Input maxLength={200} value={address} onChange={e=>setAddress(e.target.value)}/></label><label>Комментарий<Input maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label><Button block type="primary" loading={busy} disabled={invalidQuantities||unavailableCartIds.length>0||!address.trim()||groups.some(id=>!chosenDate(id))||groups.some(id=>sum(lines.filter(o=>o.supplier===id))<(suppliers.find(c=>c.id===id)?.minimum||0))} onClick={()=>void act('checkout',{key:checkoutKey.current,address,note,dates:Object.fromEntries(groups.map(id=>[id,chosenDate(id)])),lines:lines.map(o=>({id:o.id,price:o.price,quantity:cart[o.id]}))},()=>{setCart({});setBasket(false);setView('Заказы');setNotice('Заказы переданы поставщикам');})}>Оформить · {money(sum(lines))}</Button><Button block className="cart-template" onClick={()=>startTemplate(lines.map(offer=>({id:offer.id,quantity:cart[offer.id]})))}>Сохранить корзину как шаблон</Button></>}</Drawer></ConfigProvider>;
}
