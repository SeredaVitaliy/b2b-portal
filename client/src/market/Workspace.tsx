import {useState} from 'react';
import {Button,Input,InputNumber,Select,Table,Space,Modal} from 'antd';
import type {Market, Offer} from './types';
import {money,weekdays} from './types';
import {Categories} from './Operations';
import {Assortment} from './Assortment';
import {CompanyProfile,ParticipantTeam,PlatformAnalytics} from './CompanyProfile';

type Act = (path:string,data:unknown,done?:()=>void)=>Promise<void>;
type WorkspaceProps = {d:Market; act:Act; busy:boolean};

function SupplierSettings({d,act,busy,offers,productName}:WorkspaceProps & {offers:Offer[]; productName:(offer:Offer)=>string}) {
  const company = d.companies.find(item=>item.id===d.user?.company)!;
  const [minimum,setMinimum] = useState(company.minimum);
  const [lead,setLead] = useState(company.lead_days);
  const [description,setDescription] = useState(company.description);
  const [days,setDays] = useState(company.delivery_days);
  const [area,setArea] = useState(company.delivery_area??'Калининград');
  const [customer,setCustomer] = useState<number>();
  const [offer,setOffer] = useState<number>();
  const [price,setPrice] = useState(100);
  return <>
    <h2>Условия доставки</h2>
    <article>
      <Input.TextArea aria-label="Описание поставщика" value={description} maxLength={1000} onChange={event=>setDescription(event.target.value)}/>
      <div className="filters">
        <Input aria-label="Зоны доставки" placeholder="Зоны доставки" value={area} maxLength={250} onChange={event=>setArea(event.target.value)}/>
        <label>Мин. сумма <InputNumber min={0} value={minimum} onChange={n=>setMinimum(n??0)}/></label>
        <label>Срок в днях <InputNumber min={1} max={14} value={lead} onChange={n=>setLead(n??1)}/></label>
        <Select aria-label="Дни доставки" mode="multiple" value={days} onChange={setDays} options={weekdays.map((label,index)=>({label,value:index+1}))}/>
        <Button disabled={busy||!days.length||!area.trim()} onClick={()=>void act('supplier-settings',{minimum,lead,description,days,area})}>Сохранить условия</Button>
      </div>
    </article>
    {d.user?.role==='supplier_admin'&&<>
    <h2>Персональные цены</h2>
    <article>
      <div className="filters">
        <Select aria-label="Заведение" placeholder="Заведение" value={customer} onChange={setCustomer} options={d.customers.map(item=>({label:item.name,value:item.id}))}/>
        <Select aria-label="Предложение" showSearch optionFilterProp="label" placeholder="Предложение" value={offer} onChange={setOffer} options={offers.map(item=>({label:productName(item),value:item.id}))}/>
        <InputNumber aria-label="Персональная цена" min={1} value={price} onChange={n=>setPrice(n??1)}/>
        <Button disabled={busy||!offer||!customer} onClick={()=>void act('personal-price',{offer,buyer:customer,price})}>Назначить цену</Button>
      </div>
      {d.prices.map(item=><div className="row" key={item.offer+':'+item.buyer}><span>{d.customers.find(customer=>customer.id===item.buyer)?.name} · {productName(offers.find(offer=>offer.id===item.offer)!)} · {money(item.price)}</span><Button disabled={busy} onClick={()=>void act('personal-price',{offer:item.offer,buyer:item.buyer,remove:true})}>Удалить</Button></div>)}
    </article>
    </>}
  </>;
}

export function Workspace({d,act,busy}:WorkspaceProps) {
  const [title,setTitle] = useState('');
  const [description,setDescription] = useState('');
  const [category,setCategory] = useState(1);
  const [price,setPrice] = useState(100);
  const [stock,setStock] = useState(20);
  const platform = d.user?.role==='platform';
  const [moderation,setModeration] = useState<{id:number;decision:'reject'|'link'}>();
  const [reason,setReason] = useState('');
  const [target,setTarget] = useState<number>();
  function openModeration(id:number,decision:'reject'|'link') {
    setReason('');setTarget(undefined);setModeration({id,decision});
  }
  const drafts = d.products.filter(product=>!product.approved);
  const offers = d.offers.filter(offer=>offer.supplier===d.user?.company);
  const productName = (offer:Offer|undefined)=>d.products.find(product=>product.id===offer?.product)?.name ?? 'Предложение';
  const weekAgo = Date.now()-7*86_400_000;
  const weeklyRevenue = d.orders.filter(order=>order.status==='delivered'&&order.events.some(event=>event.status==='delivered'&&Date.parse(event.created)>=weekAgo))
    .flatMap(order=>order.items).reduce((sum,item)=>sum+item.price*item.quantity,0);
  const lowStock = offers.filter(offer=>offer.active!==false&&offer.stock<5*offer.pack)
    .sort((a,b)=>a.stock-b.stock);
  return <section>
    <h1>{platform?'Управление порталом':'Кабинет поставщика'}</h1>
    {!platform&&<div className="stats">
      <article><small>Новые заказы</small><h2>{d.orders.filter(order=>order.status==='new').length}</h2></article>
      <article><small>Выручка за 7 дней</small><h2>{money(weeklyRevenue)}</h2></article>
      <article><small>Позиций на исходе</small><h2>{lowStock.length}</h2></article>
    </div>}
    {platform ? <>
      {d.analytics&&<PlatformAnalytics analytics={d.analytics}/>}
      <h2>Модерация карточек</h2>
      {!drafts.filter(product=>!product.rejection).length&&<p>Все заявки обработаны.</p>}
      {drafts.filter(product=>!product.rejection).map(product=><article className="row" key={product.id}>
        {product.name}<Space wrap>
          <Button disabled={busy} onClick={()=>openModeration(product.id,'link')}>Связать с карточкой</Button>
          <Button disabled={busy} onClick={()=>openModeration(product.id,'reject')}>Отклонить</Button>
          <Button type="primary" disabled={busy} onClick={()=>void act('moderate',{id:product.id})}>Одобрить</Button>
        </Space>
      </article>)}
      <Modal open={!!moderation} title={moderation?.decision==='reject'?'Причина отклонения':'Существующая карточка'} onCancel={()=>setModeration(undefined)} okText="Применить" cancelText="Отмена"
        okButtonProps={{loading:busy,disabled:moderation?.decision==='reject'?!reason.trim():!target}}
        onOk={()=>void act('moderate',{...moderation,reason,target},()=>setModeration(undefined))}>
        {moderation?.decision==='reject'
          ? <Input.TextArea aria-label="Причина отклонения" value={reason} maxLength={300} onChange={event=>setReason(event.target.value)}/>
          : <Select aria-label="Существующая карточка" style={{width:'100%'}} value={target} onChange={setTarget} showSearch optionFilterProp="label"
              options={d.products.filter(product=>product.approved).map(product=>({value:product.id,label:product.name}))}/>}
      </Modal>
      <Categories market={d} {...{act,busy}}/>
      <h2>Участники</h2>
      {d.companies.map(company=><article className="row" key={company.id}>
        <span>{company.name} · {company.kind==='supplier'?'Поставщик':'Заведение'}{company.state==='pending'?' · Заявка '+company.registration:''}{company.tax_id&&<small> · {company.legal_name}, ИНН {company.tax_id}</small>}</span>
        <Button disabled={busy} onClick={()=>void act('company',{id:company.id,active:!company.active})}>{company.active?'Приостановить':company.state==='pending'?'Одобрить заявку':'Активировать'}</Button>
      </article>)}
      <ParticipantTeam market={d} {...{act,busy}}/>
    </> : <>
      {lowStock.length>0&&<details><summary>Товары с низким остатком</summary>
        {lowStock.map(offer=><p key={offer.id}>{productName(offer)} · {offer.stock} уп.</p>)}
      </details>}
      <h2>Новая карточка</h2>
      <form className="filters" onSubmit={event=>{event.preventDefault();void act('draft',{name:title,description,category,price,stock,unit:'уп'},()=>{setTitle('');setDescription('');});}}>
        <Input required maxLength={200} aria-label="Название" placeholder="Название и фасовка" value={title} onChange={event=>setTitle(event.target.value)}/>
        <Input maxLength={1000} aria-label="Описание товара" placeholder="Описание товара" value={description} onChange={event=>setDescription(event.target.value)}/>
        <Select aria-label="Категория" value={category} onChange={setCategory} options={d.categories.map(item=>({value:item.id,label:item.name}))}/>
        <Space wrap>
          <label>Цена <InputNumber value={price} min={1} onChange={n=>setPrice(n??1)}/></label>
          <label>Остаток <InputNumber value={stock} min={0} onChange={n=>setStock(n??0)}/></label>
          <Button htmlType="submit" disabled={busy}>На модерацию</Button>
        </Space>
      </form>
      {drafts.map(product=><p key={product.id}>{product.name} · {product.rejection||'На проверке'}</p>)}
      <Assortment key={'assortment-'+d.user?.company} history={d.history} {...{offers,productName,act,busy}}/>
      <h2>История ассортимента</h2>
      <Table rowKey="id" dataSource={d.history} pagination={{pageSize:8}} scroll={{x:570}} columns={[
        {title:'Товар',dataIndex:'name'},
        {title:'Цена',render:(_,row)=>money(row.price_before)+' → '+money(row.price_after)},
        {title:'Остаток',render:(_,row)=>row.stock_before+' → '+row.stock_after},
        {title:'Время',render:(_,row)=>new Date(row.created).toLocaleString('ru-RU',{timeZone:'Europe/Kaliningrad'})},
      ]}/>
      {d.user?.role==='supplier_admin'&&<CompanyProfile market={d} {...{act,busy}}/>}
      {d.user?.role?.startsWith('supplier')&&<SupplierSettings key={'settings-'+d.user.company} {...{d,act,busy,offers,productName}}/>}
    </>}
  </section>;
}
