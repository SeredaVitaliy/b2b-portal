import { getDatabase } from '@netlify/database';
import { handle } from '../../market/service.mjs';
export default req => handle(req,getDatabase().pool);
export const config={path:'/api/market/*'};
