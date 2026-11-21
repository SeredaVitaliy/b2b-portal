import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const tables=['companies','categories','products','offers','sessions','checkouts','orders','order_items','order_events'];
const version='202611210001_market';
let initializing;

async function prepare(pool) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sv-market-schema'))");
    await client.query('CREATE TABLE IF NOT EXISTS market_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied=await client.query('SELECT 1 FROM market_migrations WHERE version=$1',[version]);
    if(!applied.rowCount) {
      const existing=await client.query('SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename=ANY($1::text[])',[tables]);
      if(!existing.rowCount) {
        const sql=await readFile(resolve('market','migrations',version+'.sql'),'utf8');
        await client.query(sql);
      } else if(existing.rowCount!==tables.length) {
        throw Error('Incomplete market schema');
      }
      await client.query('INSERT INTO market_migrations(version) VALUES($1)',[version]);
    }
    await client.query('COMMIT');
  } catch(error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {client.release();}
}
export function initialize(pool) {
  initializing??=prepare(pool).catch(error=>{initializing=undefined;throw error;});
  return initializing;
}
