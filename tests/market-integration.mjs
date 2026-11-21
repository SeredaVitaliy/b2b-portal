import { initialize } from '../market/database.mjs';
import pg from 'pg';
import { handle } from '../market/service.mjs';
import { verifyMarket } from './market-smoke.mjs';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try {
  await initialize(pool);
  await verifyMarket('http://localhost',request=>handle(request,pool));
} finally {
  await pool.end();
}
