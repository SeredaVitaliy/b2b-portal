import {useState} from 'react';
import {Button,Input,Modal,Select,Space} from 'antd';
import type {Category,Market,Order} from './types';

type Act = (path:string,data:unknown,onSuccess?:()=>void)=>Promise<void>;
type Controls = {act:Act;busy:boolean};

export function Enrollment({open,onClose,act,busy}:Controls & {open:boolean;onClose:()=>void}) {
  const [kind,setKind]=useState('supplier');
  const [name,setName]=useState('');
  const [registration,setRegistration]=useState('');
  return <Modal open={open} onCancel={onClose} okText="Отправить заявку" cancelText="Отмена"
    title="Подключение компании" confirmLoading={busy}
    okButtonProps={{disabled:!name.trim()||!/^0\d{9}$/.test(registration)}}
    onOk={()=>void act('enroll',{kind,name,registration},()=>{setName('');setRegistration('');onClose();})}>
    <p>Укажите вымышленные данные. Код заявки состоит из десяти цифр и начинается с нуля.</p>
    <Space direction="vertical" style={{width:'100%'}}>
      <Select aria-label="Тип компании" value={kind} onChange={setKind} options={[{value:'supplier',label:'Поставщик'},{value:'buyer',label:'Заведение'}]}/>
      <Input aria-label="Название компании" placeholder="Название компании" maxLength={100} value={name} onChange={event=>setName(event.target.value)}/>
      <Input aria-label="Код заявки" placeholder="Демонстрационный код" inputMode="numeric" maxLength={10} value={registration} onChange={event=>setRegistration(event.target.value)}/>
    </Space>
  </Modal>;
}

export function Categories({market,act,busy}:Controls & {market:Market}) {
  const [name,setName]=useState('');
  const [parent,setParent]=useState<number>();
  function tree(category:Category|null):React.ReactNode {
    const children=market.categories.filter(item=>item.parent===(category?.id??null));
    if(!children.length)return null;
    return <ul>{children.map(item=><li key={item.id}>{item.name}{tree(item)}</li>)}</ul>;
  }
  return <>
    <h2>Категории</h2>
    {tree(null)}
    <form className="filters" onSubmit={event=>{event.preventDefault();void act('category',{name,parent},()=>{setName('');setParent(undefined);});}}>
      <Input required aria-label="Название категории" placeholder="Название категории" maxLength={80} value={name} onChange={event=>setName(event.target.value)}/>
      <Select allowClear aria-label="Родительская категория" placeholder="Верхний уровень" value={parent} onChange={setParent} options={market.categories.map(item=>({label:item.name,value:item.id}))}/>
      <Button htmlType="submit" disabled={busy||!name.trim()}>Создать категорию</Button>
    </form>
  </>;
}

const authorName:Record<string,string>={buyer:'Закупщик',supplier:'Поставщик',platform:'Менеджер площадки'};

export function OrderDiscussion({order,act,busy}:Controls & {order:Order}) {
  const [message,setMessage]=useState('');
  return <details>
    <summary>Обсуждение заказа{order.comments?.length ? ' · '+order.comments.length : ''}</summary>
    {order.comments?.map(comment=><p key={comment.id}><strong>{authorName[comment.author]}</strong> {comment.message}</p>)}
    <form className="filters" onSubmit={event=>{event.preventDefault();void act('order-comment',{id:order.id,message},()=>setMessage(''));}}>
      <Input aria-label="Сообщение к заказу" value={message} maxLength={500} onChange={event=>setMessage(event.target.value)}/>
      <Button htmlType="submit" disabled={busy||!message.trim()}>Отправить сообщение</Button>
    </form>
  </details>;
}
