export interface Company {id:number; name:string; kind:string; minimum:number; lead_days:number; active:boolean; description:string; delivery_days:number[]; state:string; registration:string|null; delivery_area?:string; legal_name?:string|null; tax_id?:string|null}
export interface Product {description?:string; id:number; name:string; category:number; unit:string; approved:boolean; rejection?:string|null}
export interface Offer {id:number; supplier:number; product:number; price:number|null; stock:number; pack:number; step?:number; sku?:string; active?:boolean}
export function orderQuantity(offer:Offer, quantity:number) {
  return Number.isSafeInteger(quantity)&&quantity>=offer.pack&&quantity<=offer.stock&&(quantity-offer.pack)%(offer.step??offer.pack)===0;
}
export interface Item {offer:number; name:string; price:number; quantity:number}
export interface Category {id:number;name:string;parent:number|null}
export interface Order {comments:{id:number;author:string;message:string}[]; id:number; buyer:number; supplier:number; status:string; delivery:string; address:string; note:string; created?:string; items:Item[]; events:{status:string;created:string}[]}
export interface Template {id:number; name:string; lines:{id:number;quantity:number}[]}
export interface Member {id:number;company:number;name:string;email:string;role:string;active:boolean}
export interface Analytics {turnover:number;orders:number;buyers:number;disputes:number;suppliers:{name:string;turnover:number}[];categories:{name:string;turnover:number}[]}
export type MarketAction = (path:string,data:unknown,onSuccess?:()=>void)=>Promise<void>;
export interface Market {history:{id:number;name:string;price_before:number;price_after:number;stock_before:number;stock_after:number;created:string}[]; templates:Template[]; addresses:{id:number;address:string}[]; favorites:number[]; customers:{id:number;name:string}[]; prices:{offer:number;buyer:number;price:number}[]; user:{role:string;company:number|null;member?:number|null}|null; companies:Company[]; categories:Category[]; products:Product[]; offers:Offer[]; orders:Order[]; members?:Member[]; analytics?:Analytics|null}
export const roles:Record<string,string>={buyer:'Закупщик',supplier:'Поставщик',platform:'Менеджер портала',buyer_admin:'Управляющий заведением',supplier_admin:'Руководитель поставщика'};
export const statuses:Record<string,string>={new:'Новый',confirmed:'Подтверждён',packing:'Собирается',shipping:'В пути',delivered:'Доставлен',dispute:'Спор',cancelled:'Отменён'};
export const money=(n:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
export const weekdays=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
export async function api<T>(action:string,body?:unknown):Promise<T>{
 const r=await fetch('/api/market/'+action,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.headers.get('content-type')?.includes('application/json')) throw Error('Сервис каталога временно недоступен');
 const result=await r.json();
 if(!r.ok) throw Error(result.error||'Ошибка запроса');
 return result;
}
