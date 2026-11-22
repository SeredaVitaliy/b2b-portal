-- The original seed gave all three suppliers the same stock for each product.
-- Keep values that have already participated in a real checkout or stock edit.
ALTER TABLE offers DISABLE TRIGGER market_offer_change;

UPDATE offers o
SET stock = o.stock + 7 * ((o.supplier - p.category + 8) % 8)
FROM products p
WHERE p.id = o.product AND p.id BETWEEN 1 AND 320
  AND p.submitted_by IS NULL AND o.supplier BETWEEN 1 AND 8
  AND (o.supplier - p.category + 8) % 8 IN (1, 2)
  AND o.stock = 40 + p.id % 70
  AND NOT EXISTS (
    SELECT 1 FROM market_offer_history h
    WHERE h.offer = o.id AND h.stock_before <> h.stock_after
  )
  AND NOT EXISTS (
    SELECT 1 FROM order_items i JOIN orders ord ON ord.id = i.order_id
    WHERE i.offer = o.id AND ord.checkout IS NOT NULL
  );

ALTER TABLE offers ENABLE TRIGGER market_offer_change;
