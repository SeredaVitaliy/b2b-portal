ALTER TABLE companies ADD COLUMN legal_name text NOT NULL DEFAULT '';
ALTER TABLE companies ADD COLUMN tax_id text NOT NULL DEFAULT '';
ALTER TABLE companies ADD COLUMN delivery_area text NOT NULL DEFAULT 'Калининград';
ALTER TABLE products ADD COLUMN description text NOT NULL DEFAULT '';
ALTER TABLE offers ADD COLUMN sku text NOT NULL DEFAULT '';
ALTER TABLE offers ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE offers ADD COLUMN step integer NOT NULL DEFAULT 1 CHECK(step>0);
UPDATE offers SET sku='SV-'||id,step=pack;

CREATE TABLE market_members (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 company integer NOT NULL REFERENCES companies,
 name text NOT NULL,
 email text NOT NULL UNIQUE,
 role text NOT NULL CHECK(role IN ('buyer','buyer_admin','supplier','supplier_admin')),
 invite_hash text,
 active boolean NOT NULL DEFAULT true
);
CREATE INDEX market_members_company ON market_members(company,id);
ALTER TABLE sessions ADD COLUMN member integer REFERENCES market_members ON DELETE CASCADE;

INSERT INTO market_members(company,name,email,role)
SELECT id,'Управляющий','buyer-admin@market.example','buyer_admin' FROM companies WHERE id=9
UNION ALL
SELECT id,'Закупщик','buyer@market.example','buyer' FROM companies WHERE id=9
UNION ALL
SELECT id,'Руководитель','supplier-admin@market.example','supplier_admin' FROM companies WHERE id=1
UNION ALL
SELECT id,'Менеджер поставщика','supplier@market.example','supplier' FROM companies WHERE id=1;

WITH history AS (
 SELECT buyer.id AS buyer, supplier.id AS supplier, period.age
 FROM companies buyer CROSS JOIN companies supplier
 CROSS JOIN (VALUES (5),(12),(26),(41),(55)) period(age)
 WHERE buyer.kind='buyer' AND buyer.id BETWEEN 9 AND 13 AND supplier.id BETWEEN 1 AND 8
   AND (buyer.id+supplier.id+period.age)%3=0
), seeded AS (
 INSERT INTO orders(buyer,supplier,address,delivery,note,status,created)
 SELECT buyer,supplier,'Калининград, демо-адрес',current_date-age,'Демонстрационный заказ','delivered',now()-(age+2)*interval '1 day'
 FROM history RETURNING id,supplier,created
), items AS (
 INSERT INTO order_items(order_id,offer,name,price,quantity)
 SELECT o.id,f.id,p.name,f.price,3+o.id%5
 FROM seeded o CROSS JOIN LATERAL (
   SELECT id,product,price FROM offers WHERE supplier=o.supplier ORDER BY id LIMIT 3
 ) f JOIN products p ON p.id=f.product
 RETURNING order_id
)
INSERT INTO order_events(order_id,status,created)
SELECT o.id,stage.status,o.created+stage.hours*interval '1 hour'
FROM seeded o CROSS JOIN (VALUES ('new',0),('confirmed',1),('packing',12),('shipping',30),('delivered',47)) stage(status,hours);
