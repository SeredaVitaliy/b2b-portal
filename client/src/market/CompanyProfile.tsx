import {useState,type FormEvent} from 'react';
import {Alert,Button,Input,Select} from 'antd';
import {money,roles} from './types';
import type {Analytics,Company,Market,MarketAction,Member} from './types';

type Controls = {act:MarketAction;busy:boolean};

function CompanyDetails({company,act,busy}:Controls & {company:Company}) {
  const [legalName,setLegalName] = useState(company.legal_name ?? '');
  const [taxId,setTaxId] = useState(company.tax_id ?? '');

  return <>
    <h2>Реквизиты компании</h2>
    <form className="filters" onSubmit={event=>{
      event.preventDefault();
      void act('company-profile',{legalName,taxId});
    }}>
      <Input aria-label="Юридическое название" placeholder="Юридическое название" required maxLength={180}
        value={legalName} onChange={event=>setLegalName(event.target.value)}/>
      <Input aria-label="ИНН" placeholder="ИНН" required inputMode="numeric" maxLength={12} pattern="[0-9]{10}|[0-9]{12}"
        value={taxId} onChange={event=>setTaxId(event.target.value)}/>
      <Button htmlType="submit" disabled={busy}>Сохранить реквизиты</Button>
    </form>
  </>;
}

function Team({company,members,ownMember,act,busy}:Controls & {company:Company;members:Member[];ownMember?:number|null}) {
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [role,setRole] = useState(company.kind);
  const [invite,setInvite] = useState<{email:string;code:string}>();
  const options = [company.kind,`${company.kind}_admin`].map(value=>({value,label:roles[value]}));

  function addMember(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code=crypto.randomUUID();
    void act('member',{company:company.id,name,email,role,code},()=>{
      setInvite({email:email.trim().toLowerCase(),code});
      setName('');
      setEmail('');
    });
  }

  return <>
    <h2>Сотрудники</h2>
    <form className="filters" onSubmit={addMember}>
      <Input aria-label="Имя сотрудника" placeholder="Имя сотрудника" required maxLength={100} value={name} onChange={event=>setName(event.target.value)}/>
      <Input aria-label="Почта сотрудника" placeholder="Почта сотрудника" type="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/>
      <Select aria-label="Роль нового сотрудника" value={role} onChange={setRole} options={options}/>
      <Button htmlType="submit" disabled={busy}>Добавить сотрудника</Button>
    </form>
    {invite&&<Alert type="success" closable onClose={()=>setInvite(undefined)} message={`Код доступа для ${invite.email}`} description={<code>{invite.code}</code>}/>}
    {members.filter(item=>item.company===company.id).map(item=><article className="row" key={item.id}>
      <div><strong>{item.name}</strong><p>{item.email}</p></div>
      <div className="actions">
        <Select aria-label={`Роль ${item.name}`} value={item.role} disabled={busy||item.id===ownMember} options={options}
          onChange={value=>void act('member',{company:company.id,id:item.id,role:value,active:item.active})}/>
        <Button disabled={busy||item.id===ownMember} onClick={()=>void act('member',{company:company.id,id:item.id,role:item.role,active:!item.active})}>
          {item.active?'Приостановить доступ':'Восстановить доступ'}
        </Button>
      </div>
    </article>)}
  </>;
}

export function CompanyProfile({market,act,busy}:Controls & {market:Market}) {
  const company=market.companies.find(item=>item.id===market.user?.company);
  if (!company) return null;
  return <>
    <CompanyDetails key={`details-${company.id}`} {...{company,act,busy}}/>
    <Team key={`team-${company.id}`} members={market.members??[]} ownMember={market.user?.member} {...{company,act,busy}}/>
  </>;
}

export function ParticipantTeam({market,act,busy}:Controls & {market:Market}) {
  const [companyId,setCompanyId] = useState<number>();
  const active=market.companies.filter(item=>item.active);
  const company=active.find(item=>item.id===companyId);
  return <section>
    <h2>Доступ сотрудников</h2>
    <Select aria-label="Компания сотрудника" placeholder="Выберите компанию" value={company?.id} onChange={setCompanyId}
      style={{minWidth:220}} options={active.map(item=>({value:item.id,label:item.name}))}/>
    {company&&<Team key={company.id} members={market.members??[]} {...{company,act,busy}}/>}
  </section>;
}

export function PlatformAnalytics({analytics}:{analytics:Analytics}) {
  const rankings = [
    {title:'Поставщики',rows:analytics.suppliers},
    {title:'Категории',rows:analytics.categories},
  ];
  return <section>
    <h2>Аналитика площадки</h2>
    <div className="stats">
      <article><small>Оборот доставленных заказов</small><h3>{money(analytics.turnover)}</h3></article>
      <article><small>Заказы</small><h3>{analytics.orders}</h3></article>
      <article><small>Активные заведения</small><h3>{analytics.buyers}</h3></article>
      <article><small>Открытые споры</small><h3>{analytics.disputes}</h3></article>
    </div>
    <div className="report-columns">
      {rankings.map(({title,rows})=><article key={title}>
        <h3>{title}</h3>
        {rows.length?rows.map(item=><p className="row" key={item.name}><span>{item.name}</span><strong>{money(item.turnover)}</strong></p>):<p>Появятся после доставки заказов</p>}
      </article>)}
    </div>
  </section>;
}
