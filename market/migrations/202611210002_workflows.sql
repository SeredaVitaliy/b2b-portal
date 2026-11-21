ALTER TABLE companies ADD COLUMN description text NOT NULL DEFAULT '';
ALTER TABLE companies ADD COLUMN delivery_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7];
ALTER TABLE products ADD COLUMN rejection text;
CREATE TABLE market_templates (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buyer integer NOT NULL REFERENCES companies,
  name text NOT NULL,
  lines jsonb NOT NULL
);
CREATE TABLE market_favorites (
  buyer integer REFERENCES companies,
  product integer REFERENCES products ON DELETE CASCADE,
  PRIMARY KEY(buyer, product)
);
CREATE TABLE market_addresses (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buyer integer NOT NULL REFERENCES companies,
  address text NOT NULL,
  UNIQUE(buyer,address)
);
CREATE TABLE market_prices (
  offer integer REFERENCES offers,
  buyer integer REFERENCES companies,
  price integer NOT NULL CHECK(price>0),
  PRIMARY KEY(offer,buyer)
);
