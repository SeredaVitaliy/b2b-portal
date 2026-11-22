export async function readWorkflow(db, user) {
  const buyer = user?.role.startsWith('buyer') ? user.company : null;
  const supplierAdmin = user?.role === 'supplier_admin' ? user.company : null;
  const templates = buyer ? (await db.query('SELECT id,name,lines FROM market_templates WHERE buyer=$1 ORDER BY id DESC',[buyer])).rows : [];
  const addresses = buyer ? (await db.query('SELECT id,address FROM market_addresses WHERE buyer=$1 ORDER BY id',[buyer])).rows : [];
  const favorites = buyer ? (await db.query('SELECT product FROM market_favorites WHERE buyer=$1',[buyer])).rows.map(row => row.product) : [];
  const customers = supplierAdmin ? (await db.query("SELECT id,name FROM companies WHERE kind='buyer' AND active ORDER BY name")).rows : [];
  const prices = supplierAdmin ? (await db.query('SELECT mp.* FROM market_prices mp JOIN offers o ON o.id=mp.offer WHERE o.supplier=$1',[supplierAdmin])).rows : [];
  const history = user?.role.startsWith('supplier') ? (await db.query(
    'SELECT h.*,p.name FROM market_offer_history h JOIN offers o ON o.id=h.offer JOIN products p ON p.id=o.product WHERE o.supplier=$1 ORDER BY h.id DESC LIMIT 40',
    [user.company])).rows : [];
  const members = ['platform','buyer_admin','supplier_admin'].includes(user?.role) ? (await db.query(`
    SELECT id,company,name,email,role,active FROM market_members WHERE $1='platform' OR company=$2 ORDER BY id`,
    [user.role,user.company])).rows : [];
  const analytics = user?.role === 'platform' ? (await db.query(`SELECT
    (SELECT count(*)::int FROM orders) AS orders,
    (SELECT count(DISTINCT buyer)::int FROM orders WHERE status<>'cancelled') AS buyers,
    (SELECT count(*)::int FROM orders WHERE status='dispute') AS disputes,
    (SELECT coalesce(sum(i.price::bigint*i.quantity),0)::float8 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='delivered') AS turnover,
    (SELECT coalesce(json_agg(r),'[]') FROM (SELECT c.name, sum(i.price::bigint*i.quantity)::float8 AS turnover
      FROM order_items i JOIN orders o ON o.id=i.order_id JOIN companies c ON c.id=o.supplier
      WHERE o.status='delivered' GROUP BY c.id ORDER BY turnover DESC,c.name LIMIT 5) r) AS suppliers,
    (SELECT coalesce(json_agg(r),'[]') FROM (SELECT c.name, sum(i.price::bigint*i.quantity)::float8 AS turnover
      FROM order_items i JOIN orders o ON o.id=i.order_id JOIN offers f ON f.id=i.offer
      JOIN products p ON p.id=f.product JOIN categories c ON c.id=p.category
      WHERE o.status='delivered' GROUP BY c.id ORDER BY turnover DESC,c.name LIMIT 5) r) AS categories`)).rows[0] : null;
  return {templates, addresses, favorites, customers, prices, history, members, analytics};
}

export async function manageWorkflow(db, user, path, data, {requireValue,number,label,digest}) {
  const buyer = user.role.startsWith('buyer');
  const supplier = user.role.startsWith('supplier');

  if (path === 'company-profile') {
    requireValue(['buyer_admin','supplier_admin'].includes(user.role),'Требуется роль руководителя компании',403);
    const legalName=label(data.legalName,180), taxId=label(data.taxId,12);
    requireValue(/^(?:\d{10}|\d{12})$/.test(taxId),'ИНН должен содержать 10 или 12 цифр');
    await db.query('UPDATE companies SET legal_name=$1,tax_id=$2 WHERE id=$3',[legalName,taxId,user.company]);
    return true;
  }
  if (path === 'member') {
    const platform=user.role==='platform';
    requireValue(platform||['buyer_admin','supplier_admin'].includes(user.role),'Требуется роль руководителя компании',403);
    const company=platform?number(data.company):user.company;
    const {rows:[organization]}=await db.query('SELECT kind FROM companies WHERE id=$1 AND active',[company]);
    requireValue(organization,'Компания недоступна',404);
    const allowedRoles=[organization.kind,organization.kind+'_admin'];
    requireValue(allowedRoles.includes(data.role),'Роль не подходит для этой компании');
    if (data.id !== undefined) {
      const id=number(data.id);
      requireValue(id!==user.member && typeof data.active==='boolean','Изменить собственный доступ нельзя');
      const updated=await db.query('UPDATE market_members SET role=$1,active=$2 WHERE id=$3 AND company=$4 RETURNING id',[data.role,data.active,id,company]);
      requireValue(updated.rowCount,'Сотрудник недоступен',404);
      await db.query('DELETE FROM sessions WHERE member=$1',[id]);
    } else {
      const email=label(data.email,254).toLowerCase(), code=label(data.code,80);
      requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Укажите корректную почту');
      requireValue(/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(code),'Некорректный код доступа');
      const inserted=await db.query(`INSERT INTO market_members(company,name,email,role,invite_hash)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id`,[company,label(data.name,100),email,data.role,digest(code)]);
      requireValue(inserted.rowCount,'Сотрудник с такой почтой уже существует',409);
    }
    return true;
  }

  if (path === 'order-comment') {
    const order=await db.query("SELECT id FROM orders WHERE id=$1 AND ($2='platform' OR buyer=$3 OR supplier=$3)",[number(data.id),user.role,user.company]);
    requireValue(order.rowCount,'Заказ недоступен',404);
    await db.query('INSERT INTO market_order_comments(order_id,author,message) VALUES($1,$2,$3)',[order.rows[0].id,buyer?'buyer':supplier?'supplier':'platform',label(data.message,500)]);
    return true;
  }
  if (path === 'category') {
    requireValue(user.role==='platform','Требуется роль менеджера',403);
    const name=label(data.name,80);
    const parent=data.parent?number(data.parent):null;
    if (parent) {
      const known=await db.query('SELECT id FROM categories WHERE id=$1',[parent]);
      requireValue(known.rowCount,'Родительская категория недоступна',404);
    }
    await db.query("SELECT pg_advisory_xact_lock(hashtext('sv-market-categories'))");
    const inserted=await db.query('INSERT INTO categories(id,name,parent) SELECT COALESCE(max(id),0)+1,$1,$2 FROM categories ON CONFLICT DO NOTHING RETURNING id',[name,parent]);
    requireValue(inserted.rowCount,'Категория уже существует',409);
    return true;
  }
  if (path === 'offers-batch') {
    requireValue(supplier,'Требуется роль поставщика',403);
    requireValue(Array.isArray(data.rows) && data.rows.length > 0 && data.rows.length <= 1000,'Проверьте список предложений');
    const rows = data.rows.map(row => ({id:number(row?.id), price:number(row?.price), stock:number(row?.stock,0)})).sort((a,b)=>a.id-b.id);
    requireValue(new Set(rows.map(row=>row.id)).size === rows.length,'Удалите дубли предложений из списка');
    const updated = await db.query(`UPDATE offers o SET price=u.price,stock=u.stock
      FROM jsonb_to_recordset($1) AS u(id int,price int,stock int)
      WHERE o.id=u.id AND o.supplier=$2 RETURNING o.id`,[JSON.stringify(rows),user.company]);
    requireValue(updated.rowCount === rows.length,'В списке есть недоступное предложение',404);
    return true;
  }
  if (path === 'offer-details') {
    requireValue(supplier,'Требуется роль поставщика',403);
    requireValue(typeof data.active==='boolean'&&typeof data.sku==='string'&&data.sku.length<=80,'Проверьте параметры предложения');
    const updated=await db.query('UPDATE offers SET sku=$1,pack=$2,step=$3,active=$4 WHERE id=$5 AND supplier=$6 RETURNING id',
      [data.sku.trim(),number(data.pack),number(data.step),data.active,number(data.id),user.company]);
    requireValue(updated.rowCount,'Предложение недоступно',404);
    return true;
  }
  if (path === 'template') {
    requireValue(buyer,'Требуется роль закупщика',403);
    if (data.remove) {
      await db.query('DELETE FROM market_templates WHERE id=$1 AND buyer=$2',[number(data.id),user.company]);
      return true;
    }
    requireValue(Array.isArray(data.lines) && data.lines.length>0 && data.lines.length<=200,'Добавьте позиции в шаблон');
    const lines = data.lines.map(row=>({id:number(row?.id),quantity:number(row?.quantity)}));
    requireValue(new Set(lines.map(row=>row.id)).size === lines.length,'Позиции шаблона повторяются');
    const exists = await db.query('SELECT count(*)::int AS count FROM offers WHERE id=ANY($1::int[])',[lines.map(row=>row.id)]);
    requireValue(exists.rows[0].count === lines.length,'В шаблоне есть недоступные позиции');
    const values=[user.company,label(data.name,100),JSON.stringify(lines)];
    if (data.id!==undefined) {
      const updated=await db.query('UPDATE market_templates SET name=$2,lines=$3 WHERE buyer=$1 AND id=$4 RETURNING id',[...values,number(data.id)]);
      requireValue(updated.rowCount,'Шаблон недоступен',404);
    } else await db.query('INSERT INTO market_templates(buyer,name,lines) VALUES($1,$2,$3)',values);
    return true;
  }
  if (path === 'favorite') {
    requireValue(buyer,'Требуется роль закупщика',403);
    const product=number(data.id);
    if (data.active) {
      await db.query('INSERT INTO market_favorites SELECT $1,id FROM products WHERE id=$2 AND approved ON CONFLICT DO NOTHING',[user.company,product]);
    } else {
      await db.query('DELETE FROM market_favorites WHERE buyer=$1 AND product=$2',[user.company,product]);
    }
    return true;
  }
  if (path === 'address') {
    requireValue(user.role==='buyer_admin','Требуется роль управляющего заведением',403);
    if (data.remove) await db.query('DELETE FROM market_addresses WHERE id=$1 AND buyer=$2',[number(data.id),user.company]);
    else await db.query('INSERT INTO market_addresses(buyer,address) VALUES($1,$2) ON CONFLICT DO NOTHING',[user.company,label(data.address)]);
    return true;
  }
  if (path === 'supplier-settings') {
    requireValue(supplier,'Требуется роль поставщика',403);
    requireValue(Array.isArray(data.days) && data.days.length && data.days.every(day=>Number.isInteger(day)&&day>=1&&day<=7),'Выберите хотя бы один день доставки');
    requireValue(typeof data.description==='string' && data.description.length<=1000,'Описание не длиннее 1000 символов');
    const lead = number(data.lead);
    requireValue(lead<=14,'Срок доставки не дольше 14 дней');
    const area=data.area===undefined?null:label(data.area,250);
    await db.query('UPDATE companies SET minimum=$1,lead_days=$2,description=$3,delivery_days=$4,delivery_area=COALESCE($5,delivery_area) WHERE id=$6',
      [number(data.minimum,0),lead,data.description.trim(),[...new Set(data.days)],area,user.company]);
    return true;
  }
  if (path === 'personal-price') {
    requireValue(user.role==='supplier_admin','Требуется роль руководителя поставщика',403);
    const offer=number(data.offer), customer=number(data.buyer);
    const result=await db.query("SELECT o.id FROM offers o JOIN companies c ON c.id=$3 AND c.kind='buyer' AND c.active WHERE o.id=$1 AND o.supplier=$2",[offer,user.company,customer]);
    requireValue(result.rowCount,'Клиент или предложение недоступны',404);
    if (data.remove) await db.query('DELETE FROM market_prices WHERE offer=$1 AND buyer=$2',[offer,customer]);
    else await db.query('INSERT INTO market_prices VALUES($1,$2,$3) ON CONFLICT (offer,buyer) DO UPDATE SET price=EXCLUDED.price',[offer,customer,number(data.price)]);
    return true;
  }
  return false;
}
