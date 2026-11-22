import {useState} from 'react';
import {Button,Empty,Input,InputNumber,Modal,Select} from 'antd';
import type {Market,Template} from './types';
import {CompanyProfile} from './CompanyProfile';

type Props = {
  market:Market;
  busy:boolean;
  act:(path:string,payload:unknown,onSuccess?:()=>void)=>Promise<void>;
  load:(lines:Template['lines'])=>void;
};

export function BuyerTools({market,busy,act,load}:Props) {
  const [address,setAddress] = useState('');
  const [draft,setDraft] = useState<{id?:number;name:string;lines:Template['lines']}>();
  const [newOffer,setNewOffer] = useState<number>();
  const names=new Map(market.products.map(item=>[item.id,item.name]));
  const suppliers=new Map(market.companies.map(item=>[item.id,item.name]));
  const offers=new Map(market.offers.map(item=>[item.id,item]));
  const offerName=(id:number)=>{
    const offer=offers.get(id);
    return offer?`${names.get(offer.product)} · ${suppliers.get(offer.supplier)}`:`Предложение №${id} больше недоступно`;
  };
  const openTemplate=(template?:Template)=>{setNewOffer(undefined);setDraft(template??{name:'',lines:[]});};
  return <section>
    <h1>Закупки</h1>
    <div className="heading"><h2>Шаблоны закупок</h2><Button onClick={()=>openTemplate()}>Создать шаблон</Button></div>
    {!market.templates.length&&<Empty description="Сохраните первую подборку из корзины или истории заказов"/>}
    {market.templates.map(template=><article className="row" key={template.id}>
      <div><h3>{template.name}</h3><p>{template.lines.length} поз.</p></div>
      <div className="actions">
        <Button onClick={()=>load(template.lines)}>Загрузить в корзину</Button>
        <Button disabled={busy} onClick={()=>openTemplate(template)}>Изменить шаблон</Button>
        <Button disabled={busy} onClick={()=>void act('template',{id:template.id,remove:true})}>Удалить шаблон</Button>
      </div>
    </article>)}
    <Modal open={!!draft} title={draft?.id?'Изменить шаблон':'Новый шаблон'} onCancel={()=>setDraft(undefined)}
      okText="Сохранить шаблон" cancelText="Отмена" okButtonProps={{loading:busy,disabled:!draft?.name.trim()||!draft?.lines.length}}
      onOk={()=>draft&&void act('template',draft,()=>setDraft(undefined))}>
      {draft&&<>
        <Input aria-label="Название шаблона" value={draft.name} maxLength={100} onChange={event=>setDraft({...draft,name:event.target.value})}/>
        <div className="filters">
          <Select showSearch aria-label="Предложение в шаблон" placeholder="Товар и поставщик" optionFilterProp="label"
            value={newOffer} onChange={setNewOffer} options={market.offers.filter(offer=>!draft.lines.some(line=>line.id===offer.id)).map(offer=>({value:offer.id,label:offerName(offer.id)}))}/>
          <Button disabled={newOffer===undefined} onClick={()=>{
            const offer=offers.get(newOffer!);
            if(offer)setDraft({...draft,lines:[...draft.lines,{id:offer.id,quantity:offer.pack}]});
            setNewOffer(undefined);
          }}>Добавить позицию</Button>
        </div>
        {draft.lines.map(line=><div key={line.id} className="row template-line">
          <span>{offerName(line.id)}</span>
          <InputNumber aria-label={`Количество ${offerName(line.id)}`} min={1} max={1000000} precision={0} value={line.quantity}
            onChange={quantity=>quantity!==null&&setDraft({...draft,lines:draft.lines.map(item=>item.id===line.id?{...item,quantity}:item)})}/>
          <Button aria-label={`Удалить ${offerName(line.id)}`} onClick={()=>setDraft({...draft,lines:draft.lines.filter(item=>item.id!==line.id)})}>Убрать</Button>
        </div>)}
      </>}
    </Modal>
    {market.user?.role==='buyer_admin'&&<>
      <CompanyProfile {...{market,act,busy}}/>
      <h2>Адреса доставки</h2>
      <form className="filters" onSubmit={event=>{event.preventDefault();void act('address',{address},()=>setAddress(''));}}>
        <Input required maxLength={200} aria-label="Новый адрес" placeholder="Улица, дом и вход" value={address} onChange={event=>setAddress(event.target.value)}/>
        <Button disabled={busy||!address.trim()} htmlType="submit">Добавить адрес</Button>
      </form>
      {market.addresses.map(item=><article key={item.id} className="row">{item.address}<Button disabled={busy} onClick={()=>void act('address',{id:item.id,remove:true})}>Удалить адрес</Button></article>)}
    </>}
  </section>;
}
