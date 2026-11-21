ALTER TABLE categories ADD COLUMN parent integer REFERENCES categories;
ALTER TABLE companies ADD COLUMN registration text;
ALTER TABLE companies ADD COLUMN state text NOT NULL DEFAULT 'active' CHECK(state IN ('pending','active','blocked'));
UPDATE companies SET state='blocked' WHERE NOT active;
CREATE TABLE market_order_comments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders,
  author text NOT NULL CHECK(author IN ('buyer','supplier','platform')),
  message text NOT NULL,
  created timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_order_comments_order ON market_order_comments(order_id,id);
CREATE TABLE market_offer_history (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offer integer NOT NULL REFERENCES offers,
  price_before integer NOT NULL,
  price_after integer NOT NULL,
  stock_before integer NOT NULL,
  stock_after integer NOT NULL,
  created timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_offer_history_offer ON market_offer_history(offer,id DESC);
CREATE FUNCTION market_record_offer_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.price <> NEW.price OR OLD.stock <> NEW.stock THEN
    INSERT INTO market_offer_history(offer,price_before,price_after,stock_before,stock_after)
    VALUES(OLD.id, OLD.price, NEW.price, OLD.stock, NEW.stock);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER market_offer_change AFTER UPDATE OF price,stock ON offers FOR EACH ROW EXECUTE FUNCTION market_record_offer_change();
