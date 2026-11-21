import {useState} from 'react';
import {Button,Empty,Input} from 'antd';
import type {Market,Template} from './types';

type Props = {
  market:Market;
  busy:boolean;
  act:(path:string,payload:unknown,onSuccess?:()=>void)=>Promise<void>;
  load:(lines:Template['lines'])=>void;
};

export function BuyerTools({market,busy,act,load}:Props) {
  const [address,setAddress] = useState('');
  return <section>
    <h1>Закупки</h1>
    <h2>Шаблоны закупок</h2>
    {!market.templates.length&&<Empty description="Сохраните первую подборку из корзины или истории заказов"/>}
    {market.templates.map(template=><article className="row" key={template.id}>
      <div><h3>{template.name}</h3><p>{template.lines.length} поз.</p></div>
      <div className="actions">
        <Button onClick={()=>load(template.lines)}>Загрузить в корзину</Button>
        <Button disabled={busy} onClick={()=>void act('template',{id:template.id,remove:true})}>Удалить шаблон</Button>
      </div>
    </article>)}
    {market.user?.role==='buyer_admin'&&<>
      <h2>Адреса доставки</h2>
      <form className="filters" onSubmit={event=>{event.preventDefault();void act('address',{address},()=>setAddress(''));}}>
        <Input required maxLength={200} aria-label="Новый адрес" placeholder="Улица, дом и вход" value={address} onChange={event=>setAddress(event.target.value)}/>
        <Button disabled={busy||!address.trim()} htmlType="submit">Добавить адрес</Button>
      </form>
      {market.addresses.map(item=><article key={item.id} className="row">{item.address}<Button disabled={busy} onClick={()=>void act('address',{id:item.id,remove:true})}>Удалить адрес</Button></article>)}
    </>}
  </section>;
}
