import {getDatabase} from '@netlify/database';
import {initialize} from '../../market/database.mjs';
import {handle} from '../../market/service.mjs';
export default async function market(request) {
  const {pool}=getDatabase();
  await initialize(pool);
  return handle(request,pool);
}
export const config={path:'/api/market/*'};
