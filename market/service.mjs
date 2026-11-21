import { manageWorkflow, readWorkflow } from './workflows.mjs';
import { randomBytes, createHash } from 'node:crypto';
const digest = value => createHash('sha256').update(value).digest('hex');
const roles = {buyer:9, buyer_admin:9, supplier:1, supplier_admin:1, platform:null};
const stages = ['new','confirmed','packing','shipping','delivered'];
function requireValue(condition,message,status=422) {
  if (!condition) throw Object.assign(new Error(message),{status});
}
function number(value,min=1) {
  requireValue(Number.isSafeInteger(value) && value>=min && value<=1000000,'Недопустимое число');
  return value;
}
function label(value,max=200) {
  requireValue(typeof value==='string' && value.trim().length>0 && value.length<=max,'Проверьте текстовые поля');
  return value.trim();
}
async function checkout(db,user,data) {
  requireValue(/^buyer/.test(user.role),'Требуется роль закупщика',403);
  requireValue(typeof data.key==='string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.key),'Некорректный ключ заказа');
  const address=label(data.address), note=label(data.note||'Без комментария',500);
  const inserted=await db.query('INSERT INTO checkouts VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id',[data.key,user.company]);
  if (!inserted.rowCount) {
    const previous=await db.query('SELECT id FROM checkouts WHERE id=$1 AND buyer=$2',[data.key,user.company]);
    requireValue(previous.rowCount,'Конфликт заказа',409);
    return;
  }
  requireValue(Array.isArray(data.lines) && data.lines.length>0 && data.lines.length<=200,'Проверьте корзину');
  const groups=new Map(), seen=new Set();
  for (const line of [...data.lines].sort((a,b)=>a.id-b.id)) {
    const id=number(line.id), quantity=number(line.quantity);
    requireValue(!seen.has(id),'Повтор предложения'); seen.add(id);
    const {rows:[o]}=await db.query(`SELECT o.*,COALESCE(mp.price,o.price) AS price,p.name,c.minimum,c.lead_days,c.delivery_days FROM offers o JOIN products p ON p.id=o.product JOIN companies c ON c.id=o.supplier LEFT JOIN market_prices mp ON mp.offer=o.id AND mp.buyer=$2
      WHERE o.id=$1 AND p.approved AND c.active FOR UPDATE OF o,c`,[id,user.company]);
    requireValue(o && quantity<=o.stock && quantity%o.pack===0,'Изменился остаток или размер партии',409);
    requireValue(line.price===o.price,'Цена изменилась. Обновите корзину',409);
    if (!groups.has(o.supplier)) groups.set(o.supplier,[]);
    groups.get(o.supplier).push({...o,quantity});
  }
  for (const [supplier,items] of groups) {
    const {minimum,lead_days}=items[0], date=data.dates?.[supplier];
    requireValue(items.reduce((sum,i)=>sum+i.quantity*i.price,0)>=minimum,'Не набрана минимальная сумма заказа');
    requireValue(typeof date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(date),'Выберите дату доставки');
    const {rows:[time]}=await db.query("SELECT $1::date BETWEEN (now() AT TIME ZONE 'Europe/Kaliningrad')::date+$2::int AND (now() AT TIME ZONE 'Europe/Kaliningrad')::date+60 AND extract(isodow from $1::date)::int=ANY($3::int[]) AS valid",[date,lead_days,items[0].delivery_days]);
    requireValue(time.valid,'Дата доставки недоступна');
    const {rows:[order]}=await db.query('INSERT INTO orders(checkout,buyer,supplier,address,delivery,note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',[data.key,user.company,supplier,address,date,note]);
    for (const item of items) {
      await db.query('INSERT INTO order_items VALUES($1,$2,$3,$4,$5)',[order.id,item.id,item.name,item.price,item.quantity]);
      await db.query('UPDATE offers SET stock=stock-$1 WHERE id=$2',[item.quantity,item.id]);
    }
    await db.query("INSERT INTO order_events(order_id,status) VALUES ($1,'new')",[order.id]);
  }
}
export async function handle(req,pool) {
  const reply=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store',...headers}});
  const path=new URL(req.url).pathname.split('/').pop();
  const token=req.headers.get('cookie')?.match(/(?:^|; *)market=([a-f0-9]{64})(?:;|$)/)?.[1]||'';
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    const {rows:[user]}=await db.query('SELECT s.role,s.company FROM sessions s LEFT JOIN companies c ON c.id=s.company WHERE token=$1 AND expires>now() AND (s.company IS NULL OR c.active)',[digest(token)]);
    let result={},headers={};
    if (req.method==='GET' && path==='market') {
      const companies=(await db.query("SELECT id,name,kind,active,minimum,lead_days,description,delivery_days,state,CASE WHEN $1='platform' THEN registration END AS registration FROM companies WHERE (kind='supplier' AND active) OR $1='platform' ORDER BY id",[user?.role||'guest'])).rows;
      const products=(await db.query('SELECT * FROM products WHERE approved OR $1=\'platform\' OR submitted_by=$2 ORDER BY id',[user?.role||'guest',user?.company||null])).rows;
      const offers=(await db.query('SELECT o.id,o.product,o.supplier,CASE WHEN $1 THEN COALESCE(mp.price,o.price) END AS price,stock,pack FROM offers o JOIN products p ON o.product=p.id JOIN companies c ON c.id=o.supplier LEFT JOIN market_prices mp ON mp.offer=o.id AND mp.buyer=$2 WHERE (p.approved AND c.active) OR o.supplier=$2 ORDER BY price,o.id',[!!user,user?.company??null])).rows;
      const orders=user?(await db.query(`SELECT o.*,to_char(delivery,'YYYY-MM-DD') AS delivery,
        (SELECT json_agg(i ORDER BY offer) FROM order_items i WHERE i.order_id=o.id) AS items,
        (SELECT json_agg(e ORDER BY created) FROM order_events e WHERE e.order_id=o.id) AS events,
        COALESCE((SELECT json_agg(c ORDER BY id) FROM market_order_comments c WHERE c.order_id=o.id),'[]') AS comments
        FROM orders o WHERE $1='platform' OR buyer=$2 OR supplier=$2 ORDER BY id DESC LIMIT 200`,[user.role,user.company])).rows:[];
      result={user:user||null,companies,products,offers,orders,...await readWorkflow(db,user),categories:(await db.query('SELECT * FROM categories ORDER BY id')).rows};
    } else {
      requireValue(req.method==='POST' && req.headers.get('content-type')?.startsWith('application/json'),'Неверный метод',405);
      const origin=req.headers.get('origin');
      requireValue(!origin||origin===new URL(req.url).origin,'Недопустимый источник',403);
      const data=await req.json().catch(()=>null);
      requireValue(data && typeof data==='object','Неверный формат');
      if (path==='login'||path==='logout') {
        await db.query('DELETE FROM sessions WHERE token=$1 OR expires<=now()',[digest(token)]);
        const next=randomBytes(32).toString('hex');
        if (path==='login') {
          requireValue(Object.hasOwn(roles,data.role),'Неизвестная роль');
          await db.query('INSERT INTO sessions(token,role,company) VALUES($1,$2,$3)',[digest(next),data.role,roles[data.role]]);
        }
        headers={'Set-Cookie':`market=${path==='login'?next:''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${path==='login'?14400:0}${req.url.startsWith('https:')?'; Secure':''}`};
      } else if(path==='enroll') {
        requireValue(['buyer','supplier'].includes(data.kind),'Выберите тип компании');
        const registration=label(data.registration,32);
        requireValue(/^0[0-9]{9}$/.test(registration),'Укажите десятизначный демонстрационный код, начинающийся с нуля');
        const company=await db.query("INSERT INTO companies(name,kind,active,state,registration) VALUES($1,$2,false,'pending',$3) ON CONFLICT DO NOTHING RETURNING id",[label(data.name,100),data.kind,registration]);
        requireValue(company.rowCount,'Компания с таким названием уже зарегистрирована',409);
      } else {
        requireValue(user,'Войдите в демо',401);
        if (path==='checkout') await checkout(db,user,data);
        else if (path==='offer') {
          requireValue(user.role.startsWith('supplier'),'Требуется роль поставщика',403);
          const updated=await db.query('UPDATE offers SET price=$1,stock=$2 WHERE id=$3 AND supplier=$4 RETURNING id',[number(data.price),number(data.stock,0),number(data.id),user.company]);
          requireValue(updated.rowCount,'Предложение недоступно',404);
        } else if (path==='draft') {
          requireValue(user.role.startsWith('supplier'),'Требуется роль поставщика',403);
          const {rows:[p]}=await db.query('INSERT INTO products(name,category,unit,submitted_by) VALUES($1,$2,$3,$4) RETURNING id',[label(data.name),number(data.category),label(data.unit,12),user.company]);
          await db.query('INSERT INTO offers(product,supplier,price,stock) VALUES($1,$2,$3,$4)',[p.id,user.company,number(data.price),number(data.stock,0)]);
        } else if (path==='moderate') {
          requireValue(user.role==='platform','Требуется роль менеджера',403);
          const id=number(data.id);
          const draft=await db.query('SELECT id FROM products WHERE id=$1 AND NOT approved AND rejection IS NULL FOR UPDATE',[id]);
          requireValue(draft.rowCount,'Карточка уже обработана',409);
          if(data.decision==='reject') {
            await db.query('UPDATE products SET rejection=$2 WHERE id=$1',[id,label(data.reason,300)]);
          } else if(data.decision==='link') {
            const target=number(data.target);
            const match=await db.query('SELECT id FROM products WHERE id=$1 AND approved',[target]);
            requireValue(match.rowCount,'Выберите опубликованную карточку',404);
            const conflict=await db.query('SELECT 1 FROM offers a JOIN offers b ON b.supplier=a.supplier AND b.product=$2 WHERE a.product=$1',[id,target]);
            requireValue(!conflict.rowCount,'У поставщика уже есть предложение по этой карточке',409);
            await db.query('UPDATE offers SET product=$2 WHERE product=$1',[id,target]);
            await db.query('DELETE FROM products WHERE id=$1',[id]);
          } else {
            requireValue(data.decision===undefined||data.decision==='approve','Неизвестное решение');
            await db.query('UPDATE products SET approved=true WHERE id=$1',[id]);
          }
        } else if (path==='company') {
          requireValue(user.role==='platform' && typeof data.active==='boolean','Недостаточно прав',403);
          await db.query("UPDATE companies SET active=$1,state=CASE WHEN $1 THEN 'active' ELSE 'blocked' END WHERE id=$2",[data.active,number(data.id)]);
        } else if (path==='status') {
          const {rows:[o]}=await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[number(data.id)]);
          requireValue(o,'Заказ недоступен',404);
          const forward=user.company===o.supplier && stages.includes(o.status) && stages[stages.indexOf(o.status)+1]===data.status;
          const cancel=user.company===o.buyer && o.status==='new' && data.status==='cancelled';
          const dispute=(user.company===o.buyer||user.company===o.supplier) && ['confirmed','packing','shipping','delivered'].includes(o.status) && data.status==='dispute';
          const resolve=user.role==='platform' && o.status==='dispute' && ['delivered','cancelled'].includes(data.status);
          requireValue(typeof data.status==='string' && (forward||cancel||dispute||resolve),'Недоступный переход',409);
          await db.query('UPDATE orders SET status=$1 WHERE id=$2',[data.status,o.id]);
          await db.query('INSERT INTO order_events(order_id,status) VALUES($1,$2)',[o.id,data.status]);
          if(data.status==='cancelled') await db.query('UPDATE offers SET stock=stock+i.quantity FROM order_items i WHERE i.order_id=$1 AND offers.id=i.offer',[o.id]);
        } else requireValue(await manageWorkflow(db,user,path,data,{requireValue,number,label}),'Маршрут не найден',404);
      }
    }
    await db.query('COMMIT'); return reply(result,200,headers);
  } catch(error) {
    await db.query('ROLLBACK');
    if(!error.status) console.error('market request',error.code||error.name);
    return reply({error:error.status?error.message:'Ошибка обработки запроса'},error.status||500);
  } finally { db.release(); }
}
