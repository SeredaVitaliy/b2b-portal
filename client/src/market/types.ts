export interface Company {id:number; name:string; kind:string; minimum:number; lead_days:number; active:boolean}
export interface Product {id:number; name:string; category:number; unit:string; approved:boolean}
export interface Offer {id:number; supplier:number; product:number; price:number|null; stock:number; pack:number}
export interface Item {offer:number; name:string; price:number; quantity:number}
export interface Order {id:number; buyer:number; supplier:number; status:string; delivery:string; address:string; note:string; items:Item[]; events:{status:string;created:string}[]}
export interface Market {user:{role:string;company:number|null}|null; companies:Company[]; categories:{id:number;name:string}[]; products:Product[]; offers:Offer[]; orders:Order[]}
export const roles:Record<string,string>={buyer:'Закупщик',supplier:'Поставщик',platform:'Менеджер портала',buyer_admin:'Управляющий заведением',supplier_admin:'Руководитель поставщика'};
export const statuses:Record<string,string>={new:'Новый',confirmed:'Подтверждён',packing:'Собирается',shipping:'В пути',delivered:'Доставлен',dispute:'Спор',cancelled:'Отменён'};
export const money=(n:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
export const symbols=['','🍅','🥛','🐟','🍐','🥖','🌾','🥩','☕'];
export async function api<T>(action:string,body?:unknown):Promise<T>{
 const r=await fetch('/api/market/'+action,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.headers.get('content-type')?.includes('application/json')) throw Error('Сервис каталога временно недоступен');
 const result=await r.json();
 if(!r.ok) throw Error(result.error||'Ошибка запроса');
 return result;
}
