import {useState} from 'react';
import {Button,Input,InputNumber,Select,Upload,Alert,Table,Space,Modal} from 'antd';
import Papa from 'papaparse';
import type {Market, Offer} from './types';
import {money,weekdays} from './types';

type Act = (path:string,data:unknown,done?:()=>void)=>Promise<void>;
type Edit = {id:number; price:number; stock:number};
type WorkspaceProps = {d:Market; act:Act; busy:boolean};

function downloadCsv(rows:Edit[]) {
  const url = URL.createObjectURL(new Blob(['\ufeff',Papa.unparse(rows,{columns:['id','price','stock']})],{type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ассортимент.csv';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function Assortment({offers,productName,act,busy}:{offers:Offer[]; productName:(offer:Offer)=>string; act:Act; busy:boolean}) {
  const [filter,setFilter] = useState('');
  const [edits,setEdits] = useState<Record<number,Edit>>({});
  const [importError,setImportError] = useState('');
  const visibleOffers = offers.filter(offer=>productName(offer).toLowerCase().includes(filter.trim().toLowerCase()));
  const currentRow = (offer:Offer):Edit => edits[offer.id] ?? {id:offer.id,price:offer.price!,stock:offer.stock};
  const updates = Object.values(edits);

  async function importCsv(file:File) {
    setImportError('');
    const csv=Papa.parse<Record<string,string>>(await file.text(),{header:true,skipEmptyLines:'greedy'});
    if (csv.errors.length || !['id','price','stock'].every(name=>csv.meta.fields?.includes(name)) || !csv.data.length) {
      setImportError('У CSV должны быть колонки id, price и stock. Возьмите их из выгрузки.');
      return;
    }
    const ownIds = new Set(offers.map(offer=>offer.id));
    const incoming:Record<number,Edit> = {};
    for (const [index,line] of csv.data.entries()) {
      const row = {id:Number(line.id),price:Number(line.price),stock:Number(line.stock)};
      const valid = [line.id,line.price,line.stock].every(value=>/^\d+$/.test(value?.trim())) &&
        [row.id,row.price,row.stock].every(value=>Number.isSafeInteger(value)&&value<=1000000) &&
        ownIds.has(row.id) && row.price>0 && !incoming[row.id];
      if (!valid) {
        setImportError('Строка '+(index+2)+': проверьте идентификатор, цену и остаток. Повторы не допускаются.');
        return;
      }
      incoming[row.id] = row;
    }
    setEdits(previous=>({...previous,...incoming}));
  }

  return <>
    <div className="heading"><h2>Ассортимент</h2><Input aria-label="Поиск в ассортименте" placeholder="Найти в ассортименте" value={filter} onChange={event=>setFilter(event.target.value)}/></div>
    <div className="filters">
      <Button onClick={()=>downloadCsv(visibleOffers.map(currentRow))}>Экспорт CSV</Button>
      <Upload accept=".csv,text/csv" showUploadList={false} beforeUpload={file=>{void importCsv(file);return false;}}><Button>Импорт CSV</Button></Upload>
      <Button type="primary" loading={busy} disabled={!updates.length} onClick={()=>void act('offers-batch',{rows:updates},()=>setEdits({}))}>Сохранить изменения{updates.length ? ' · '+updates.length : ''}</Button>
    </div>
    {importError&&<Alert type="error" message={importError}/>}
    <Table rowKey="id" dataSource={visibleOffers} pagination={{pageSize:12}} scroll={{x:520}} columns={[
      {title:'Товар',render:(_,offer)=>productName(offer)},
      {title:'Цена за упаковку, ₽',render:(_,offer)=><InputNumber aria-label="Цена" min={1} max={1000000} precision={0} value={currentRow(offer).price} onChange={price=>price!==null&&setEdits(previous=>({...previous,[offer.id]:{...currentRow(offer),price}}))}/>},
      {title:'Остаток, уп.',render:(_,offer)=><InputNumber aria-label="Остаток" min={0} max={1000000} precision={0} value={currentRow(offer).stock} onChange={stock=>stock!==null&&setEdits(previous=>({...previous,[offer.id]:{...currentRow(offer),stock}}))}/>},
    ]}/>
  </>;
}

function SupplierSettings({d,act,busy,offers,productName}:WorkspaceProps & {offers:Offer[]; productName:(offer:Offer)=>string}) {
  const company = d.companies.find(item=>item.id===d.user?.company)!;
  const [minimum,setMinimum] = useState(company.minimum);
  const [lead,setLead] = useState(company.lead_days);
  const [description,setDescription] = useState(company.description);
  const [days,setDays] = useState(company.delivery_days);
  const [customer,setCustomer] = useState<number>();
  const [offer,setOffer] = useState<number>();
  const [price,setPrice] = useState(100);
  return <>
    <h2>Условия доставки</h2>
    <article>
      <Input.TextArea aria-label="Описание поставщика" value={description} maxLength={1000} onChange={event=>setDescription(event.target.value)}/>
      <div className="filters">
        <label>Мин. сумма <InputNumber min={0} value={minimum} onChange={n=>setMinimum(n??0)}/></label>
        <label>Срок в днях <InputNumber min={1} max={14} value={lead} onChange={n=>setLead(n??1)}/></label>
        <Select aria-label="Дни доставки" mode="multiple" value={days} onChange={setDays} options={weekdays.map((label,index)=>({label,value:index+1}))}/>
        <Button disabled={busy||!days.length} onClick={()=>void act('supplier-settings',{minimum,lead,description,days})}>Сохранить условия</Button>
      </div>
    </article>
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
  </>;
}

export function Workspace({d,act,busy}:WorkspaceProps) {
  const [title,setTitle] = useState('');
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
  return <section>
    <h1>{platform?'Управление порталом':'Кабинет поставщика'}</h1>
    <div className="stats">
      <article><small>Заказов в работе</small><h2>{d.orders.filter(order=>['new','confirmed','packing','shipping'].includes(order.status)).length}</h2></article>
      <article><small>Доставлено на сумму</small><h2>{money(d.orders.filter(order=>order.status==='delivered').flatMap(order=>order.items).reduce((sum,item)=>sum+item.price*item.quantity,0))}</h2></article>
    </div>
    {platform ? <>
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
      <h2>Участники</h2>
      {d.companies.map(company=><article className="row" key={company.id}>
        <span>{company.name} · {company.kind==='supplier'?'Поставщик':'Заведение'}</span>
        <Button disabled={busy} onClick={()=>void act('company',{id:company.id,active:!company.active})}>{company.active?'Приостановить':'Активировать'}</Button>
      </article>)}
    </> : <>
      <h2>Новая карточка</h2>
      <form className="filters" onSubmit={event=>{event.preventDefault();void act('draft',{name:title,category,price,stock,unit:'уп'},()=>setTitle(''));}}>
        <Input required maxLength={200} aria-label="Название" placeholder="Название и фасовка" value={title} onChange={event=>setTitle(event.target.value)}/>
        <Select aria-label="Категория" value={category} onChange={setCategory} options={d.categories.map(item=>({value:item.id,label:item.name}))}/>
        <Space wrap>
          <label>Цена <InputNumber value={price} min={1} onChange={n=>setPrice(n??1)}/></label>
          <label>Остаток <InputNumber value={stock} min={0} onChange={n=>setStock(n??0)}/></label>
          <Button htmlType="submit" disabled={busy}>На модерацию</Button>
        </Space>
      </form>
      {drafts.map(product=><p key={product.id}>{product.name} · {product.rejection||'На проверке'}</p>)}
      <Assortment {...{offers,productName,act,busy}}/>
      {d.user?.role==='supplier_admin'&&<SupplierSettings {...{d,act,busy,offers,productName}}/>}
    </>}
  </section>;
}
