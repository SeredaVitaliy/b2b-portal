import { useEffect,useRef,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Button,Drawer,Modal,Select,Input,InputNumber,Empty,Alert,ConfigProvider,Pagination } from 'antd';
import { ShopOutlined,ShoppingOutlined,SearchOutlined,EnvironmentOutlined,ArrowRightOutlined } from '@ant-design/icons';
import {api,money,roles,statuses,symbols} from './types';
import type {Market,Product,Offer} from './types';
import {Workspace} from './Workspace';
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
export default function App(){
 const cache=useQueryClient();
 const query=useQuery({queryKey:['market'],queryFn:()=>api<Market>('market'),retry:1});
 const d=query.data, role=d?.user?.role||'', buyer=role.startsWith('buyer');
 const [view,setView]=useState('Каталог'),[search,setSearch]=useState(''),[cat,setCat]=useState(0),[supplier,setSupplier]=useState(0),[page,setPage]=useState(1),[sort,setSort]=useState('catalog'),[stock,setStock]=useState(false);
 const [login,setLogin]=useState(false),[product,setProduct]=useState<Product|null>(null),[basket,setBasket]=useState(false),[cart,setCart]=useState<Cart>(savedCart);
 const [address,setAddress]=useState('Калининград, ресторан «Порт»'),[note,setNote]=useState(''),[dates,setDates]=useState<Record<number,string>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const checkoutKey=useRef(crypto.randomUUID()),lock=useRef(false);
 useEffect(()=>{localStorage.setItem(storageKey,JSON.stringify(cart));checkoutKey.current=crypto.randomUUID();},[cart,address,note,dates]);
 useEffect(()=>{setPage(1);},[search,cat,supplier,stock,sort]);
 async function act(path:string,data:unknown,done?:()=>void){
  if(lock.current)return; lock.current=true;setBusy(true);setError('');setNotice('');
  try {await api(path,data);done?.();await cache.invalidateQueries({queryKey:['market']});}
  catch(e){setError(e instanceof Error?e.message:'Ошибка запроса');await query.refetch();}
  finally{lock.current=false;setBusy(false);}
 }
 const name=(id:number)=>d?.companies.find(c=>c.id===id)?.name||'Компания №'+id;
 const byProduct=new Map<number,Offer[]>();
 for(const o of d?.offers||[]) {const offers=byProduct.get(o.product)||[];offers.push(o);byProduct.set(o.product,offers);}
 const matching=(p:Product)=>(byProduct.get(p.id)||[]).filter(o=>(!supplier||o.supplier===supplier)&&(!stock||o.stock>=o.pack));
 const filtered=(d?.products||[]).filter(p=>p.approved&&(!cat||p.category===cat)&&p.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())&&matching(p).length);
 if(sort==='price')filtered.sort((a,b)=>(matching(a)[0].price||0)-(matching(b)[0].price||0));
 const suppliers=(d?.companies||[]).filter(c=>c.active&&c.kind==='supplier');
 const lines=(d?.offers||[]).filter(o=>cart[o.id]>0);
 const groups=[...new Set(lines.map(o=>o.supplier))];
 const sum=(rows:Offer[])=>rows.reduce((n,o)=>n+(o.price||0)*cart[o.id],0);
 const setQuantity=(id:number,n:number)=>setCart(prev=>{const next={...prev};if(n)next[id]=n;else delete next[id];return next;});
 function changeRole(r:string){void act(r?'login':'logout',{role:r},()=>{setLogin(false);setProduct(null);setBasket(false);setView('Каталог');});}
 return <ConfigProvider theme={{token:{colorPrimary:'#215743',borderRadius:8,fontFamily:'Inter, Arial, sans-serif'}}}>
 <header><div className="brand"><i>sv</i> маркет</div><nav>{['Каталог','Поставщики',...(role?['Заказы']:[]),...(role&&!buyer?['Кабинет']:[])].map(v=><button className={view===v?'active':''} onClick={()=>setView(v)} key={v}>{v}</button>)}</nav><div className="actions"><Button onClick={()=>setLogin(true)}>{roles[role]||'Демо-вход'}</Button><Button aria-label="Открыть корзину" icon={<ShoppingOutlined/>} onClick={()=>buyer?setBasket(true):setLogin(true)}>{Object.keys(cart).length}</Button></div></header>
 <main>{(error||query.error)&&<Alert type="error" showIcon message={error||query.error?.message} action={<Button onClick={()=>{setError('');void query.refetch();}}>Обновить</Button>}/>}
 {notice&&<Alert type="success" showIcon message={notice} closable onClose={()=>setNotice('')}/>}
 {view==='Каталог'&&<><section className="hero"><div><small><EnvironmentOutlined/> Калининградская область</small><h1>Закупки для<br/><em>вашей кухни.</em></h1><p>Продукты от местных поставщиков с доставкой в заведение.</p></div><div className="still" aria-hidden="true"><span>🍅</span><span>🌿</span><span>🍋</span></div></section>
 <section><div className="heading"><div><small>Оптовые закупки</small><h2>Каталог продуктов</h2></div><Input prefix={<SearchOutlined/>} allowClear placeholder="Найти продукт" aria-label="Поиск" value={search} onChange={e=>setSearch(e.target.value)}/></div>
 <div className="chips">{[{id:0,name:'Все категории'},...(d?.categories||[])].map(c=><button key={c.id} className={cat===c.id?'on':''} onClick={()=>setCat(c.id)}>{c.name}</button>)}</div>
 <div className="filters"><Select aria-label="Поставщик" value={supplier} onChange={setSupplier} options={[{value:0,label:'Все поставщики'},...suppliers.map(c=>({value:c.id,label:c.name}))]}/><label><input type="checkbox" checked={stock} onChange={e=>setStock(e.target.checked)}/> В наличии</label>{role&&<Select aria-label="Сортировка" value={sort} onChange={setSort} options={[{value:'catalog',label:'По каталогу'},{value:'price',label:'Сначала дешевле'}]}/>}<span>{filtered.length} позиций</span></div>
 <div className="grid">{filtered.slice((page-1)*24,page*24).map(p=>{const os=matching(p);return <button className="card" key={p.id} onClick={()=>setProduct(p)}><div className={'art c'+p.category}>{symbols[p.category]}</div><div className="info"><small>{d?.categories.find(c=>c.id===p.category)?.name}</small><h3>{p.name}</h3><strong>{role?'от '+money(os[0].price||0):'Цена после входа'}</strong><footer>{os.length} предложения <ArrowRightOutlined/></footer></div></button>;})}</div>
 {!filtered.length&&<Empty description={query.isLoading?'Загружаем каталог…':'Товары не найдены'}/>}<Pagination current={page} pageSize={24} total={filtered.length} onChange={setPage} showSizeChanger={false}/></section></>}
 {view==='Поставщики'&&<section><h1>Поставщики</h1><div className="grid">{suppliers.map(c=><button className="supplier" key={c.id} onClick={()=>{setSupplier(c.id);setCat(0);setSearch('');setView('Каталог');}}><ShopOutlined/><h3>{c.name}</h3><p>Доставка от {c.lead_days} дн.</p><strong>Заказ от {money(c.minimum)}</strong></button>)}</div></section>}
 {d&&view==='Кабинет'&&<Workspace d={d} act={act} busy={busy}/>}
 {d&&view==='Заказы'&&<section><h1>Заказы</h1>{!d.orders.length&&<Empty description="Заказов пока нет"/>}{d.orders.map(o=><article key={o.id}><div className="row"><h3>Заказ №{o.id} · {name(o.supplier)}</h3><b>{statuses[o.status]}</b></div><p>{o.address} · {o.delivery} · {o.note}</p>{o.items.map(i=><p key={i.offer}>{i.name} × {i.quantity} · {money(i.price*i.quantity)}</p>)}<small>{o.events.map(e=>statuses[e.status]).join(' → ')}</small><div className="filters">{buyer&&<Button onClick={()=>{setCart(Object.fromEntries(o.items.map(i=>[i.offer,i.quantity])));setBasket(true);}}>Повторить заказ</Button>}{(buyer&&o.status==='new'?['cancelled']:role.startsWith('supplier')?({new:['confirmed'],confirmed:['packing','dispute'],packing:['shipping','dispute'],shipping:['delivered','dispute']} as Record<string,string[]>)[o.status]||[]:role==='platform'&&o.status==='dispute'?['delivered','cancelled']:buyer&&['confirmed','packing','shipping','delivered'].includes(o.status)?['dispute']:[]).map(s=><Button disabled={busy} key={s} onClick={()=>void act('status',{id:o.id,status:s})}>{statuses[s]}</Button>)}</div></article>)}</section>}
 </main><div className="bottom">SV маркет <span>Оптовые закупки · Калининград</span></div>
 <Modal open={login} onCancel={()=>setLogin(false)} title="Войти в демо" footer={null}><p>Выберите роль, чтобы пройти сценарий закупки.</p><div className="rolelist">{Object.entries(roles).map(([r,n])=><Button disabled={busy} key={r} onClick={()=>changeRole(r)}>{n}</Button>)}{role&&<Button onClick={()=>changeRole('')}>Выйти</Button>}</div></Modal>
 <Drawer open={!!product} onClose={()=>setProduct(null)} title={product?.name} width={450}>{product&&<><div className={'art c'+product.category}>{symbols[product.category]}</div><h2>Предложения</h2>{(byProduct.get(product.id)||[]).map(o=><article key={o.id}><h3>{name(o.supplier)}</h3><p>В наличии {o.stock} уп. · Партия {o.pack} уп.</p><div className="row"><strong>{role?money(o.price||0):'Цена после входа'}</strong>{(!role||buyer)&&<Button disabled={buyer&&(cart[o.id]||0)+o.pack>o.stock} onClick={()=>{if(!buyer){setProduct(null);setLogin(true);return;}setQuantity(o.id,(cart[o.id]||0)+o.pack);}}>{cart[o.id]?'В корзине: '+cart[o.id]+' · Добавить':'В корзину'}</Button>}</div></article>)}</>}</Drawer>
 <Drawer open={basket} onClose={()=>setBasket(false)} title="Корзина" width={510}>{error&&<Alert type="error" message={error}/>}
 {!lines.length?<Empty description="Корзина пуста"/>:<>{groups.map(id=>{const c=suppliers.find(x=>x.id===id)!;const rows=lines.filter(o=>o.supplier===id);return <article key={id}><h3>{c.name}</h3>{rows.map(o=><div className="cartrow" key={o.id}><span>{d?.products.find(p=>p.id===o.product)?.name}</span><InputNumber aria-label="Количество" min={0} max={o.stock} step={o.pack} value={cart[o.id]} onChange={n=>setQuantity(o.id,n||0)}/><b>{money((o.price||0)*cart[o.id])}</b></div>)}<p>{sum(rows)<c.minimum?'До минимального заказа '+money(c.minimum-sum(rows)):'Минимальная сумма набрана'}</p><label>Дата доставки <input type="date" min={dateAfter(c.lead_days)} max={dateAfter(60)} value={dates[id]||dateAfter(c.lead_days)} onChange={e=>setDates({...dates,[id]:e.target.value})}/></label></article>;})}
 <label>Адрес доставки<Input value={address} onChange={e=>setAddress(e.target.value)}/></label><label>Комментарий<Input value={note} onChange={e=>setNote(e.target.value)}/></label><Button block type="primary" loading={busy} disabled={!address.trim()||groups.some(id=>sum(lines.filter(o=>o.supplier===id))<(suppliers.find(c=>c.id===id)?.minimum||0))} onClick={()=>void act('checkout',{key:checkoutKey.current,address,note,dates:Object.fromEntries(groups.map(id=>[id,dates[id]||dateAfter(suppliers.find(c=>c.id===id)!.lead_days)])),lines:lines.map(o=>({id:o.id,price:o.price,quantity:cart[o.id]}))},()=>{setCart({});setBasket(false);setView('Заказы');setNotice('Заказы переданы поставщикам');})}>Оформить · {money(sum(lines))}</Button></>}</Drawer></ConfigProvider>;
}
