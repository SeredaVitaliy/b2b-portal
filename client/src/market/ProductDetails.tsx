import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeftOutlined,HeartFilled,HeartOutlined} from '@ant-design/icons';
import {Button,Empty,InputNumber,Select,Tag} from 'antd';
import type {Company,Offer,Product} from './types';
import {money,orderQuantity,weekdays} from './types';
import {ProductImage} from './ProductImage';

type Props = {
 product:Product;
 category:string;
 companies:Map<number,Company>;
 offers:Offer[];
 signedIn:boolean;
 buyer:boolean;
 favorite:boolean;
 cart:Record<number,number>;
 onFavorite:()=>void;
 onAdd:(id:number,quantity:number)=>void;
 onLogin:()=>void;
};

export function ProductDetails({product,category,companies,offers,signedIn,buyer,favorite,cart,onFavorite,onAdd,onLogin}:Props) {
 const [sort,setSort] = useState('price');
 const [amounts,setAmounts] = useState<Record<number,number>>({});
 const ordered = [...offers].sort((a,b)=>{
  if(sort==='delivery') return companies.get(a.supplier)!.lead_days-companies.get(b.supplier)!.lead_days;
  if(sort==='minimum') return companies.get(a.supplier)!.minimum-companies.get(b.supplier)!.minimum;
  return (a.price??0)-(b.price??0);
 });
 return <section className="product-detail">
  <nav aria-label="Навигация по каталогу"><Link to="/catalog"><ArrowLeftOutlined/> Каталог</Link><span aria-hidden="true">/</span><span>{category}</span></nav>
  <div className="product-summary">
   <ProductImage product={product} detail/>
   <div>
    <small>{category}</small>
    <h1>{product.name}</h1>
    <p>{product.description || 'Выберите поставщика, чтобы сравнить цену, остаток и условия доставки.'}</p>
    <p>Единица заказа: {product.unit}</p>
    {buyer&&<Button aria-pressed={favorite} icon={favorite?<HeartFilled/>:<HeartOutlined/>} onClick={onFavorite}>{favorite?'В избранном':'В избранное'}</Button>}
   </div>
  </div>
  <div className="heading">
   <h2>Предложения</h2>
   <Select aria-label="Сортировка предложений" value={sort} onChange={setSort} options={[{value:'price',label:'По цене'},{value:'delivery',label:'По сроку доставки'},{value:'minimum',label:'По сумме заказа'}]}/>
  </div>
  {!ordered.length&&<Empty description="Нет активных предложений"/>}
  {ordered.map(offer=>{
   const company=companies.get(offer.supplier)!;
   const inCart=cart[offer.id]??0;
   const step=offer.step??offer.pack;
   const minimum=inCart?step:offer.pack;
   const quantity=Math.max(amounts[offer.id]??minimum,minimum);
   const available=offer.stock-inCart;
   return <article className="offer-row" key={offer.id}>
    <div>
     <h3><Link to={'/suppliers/'+offer.supplier}>{company.name}</Link></h3>
     <p>Доставка от {company.lead_days} дн. · {company.delivery_days.map(day=>weekdays[day-1]).join(', ')}</p>
     <p>Минимальный заказ {money(company.minimum)}</p>
    </div>
    <div>
     <Tag color={offer.stock>=offer.pack?'green':'default'}>{offer.stock>=offer.pack?'В наличии '+offer.stock+' уп.':'Нет в наличии'}</Tag>
     <p>Партия от {offer.pack} уп. · шаг {step} уп.</p>
     {offer.sku&&<small>Арт. {offer.sku}</small>}
     <strong>{signedIn&&offer.price!==null?money(offer.price):'Цена после входа'}</strong>
    </div>
    <div className="offer-actions">
     {buyer&&available>=minimum&&<InputNumber aria-label={'Количество · '+company.name} min={minimum} max={available} step={step} precision={0}
       value={quantity} onChange={value=>setAmounts(previous=>({...previous,[offer.id]:value??minimum}))}/>}
     {!signedIn&&<Button onClick={onLogin}>Войти для заказа</Button>}
     {buyer&&<Button type="primary" disabled={quantity<minimum||!orderQuantity(offer,inCart+quantity)}
       onClick={()=>{onAdd(offer.id,quantity);setAmounts(previous=>({...previous,[offer.id]:step}));}}>В корзину</Button>}
     {Boolean(cart[offer.id])&&<small>В корзине {cart[offer.id]} уп.</small>}
    </div>
   </article>;
  })}
 </section>;
}
