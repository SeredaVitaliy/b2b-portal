import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {once} from 'node:events';
import {resolve} from 'node:path';
import pg from 'pg';
import {WebSocketServer,WebSocket} from 'ws';
import {initialize} from './database.mjs';
import {handle} from './service.mjs';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Set DATABASE_URL to a local development database.');
const port = Number(process.env.MARKET_PORT ?? 4000);
const pool = new pg.Pool({connectionString: databaseUrl});

const sockets = new WebSocketServer({noServer:true,maxPayload:1024});
const inventoryMutations=new Set(['checkout','status','offer','offers-batch','offer-details','moderate','company','personal-price','supplier-settings']);
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, 'http://' + incoming.headers.host);
    if (!url.pathname.startsWith('/api/market/')) {
      outgoing.writeHead(404).end();
      return;
    }
    const body = ['GET','HEAD'].includes(incoming.method) ? undefined : Readable.toWeb(incoming);
    const request = new Request(url,{method:incoming.method,headers:incoming.headers,body,duplex:'half'});
    const response = await handle(request,pool);
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
    if (response.ok && request.method==='POST' && inventoryMutations.has(url.pathname.split('/').at(-1))) {
      for (const client of sockets.clients) {
        if (client.readyState===WebSocket.OPEN) client.send('catalog-updated');
      }
    }
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Локальный API недоступен'}));
  }
});
server.on('upgrade',(request,socket,head)=>{
  if(request.url!=='/api/market/updates'||request.headers.origin!=='http://'+request.headers.host){
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request,socket,head,client=>sockets.emit('connection',client,request));
});
let frontend;
async function close() {
  for (const client of sockets.clients) client.terminate();
  await Promise.all([
    frontend?.close(),
    new Promise(resolveClose=>server.close(resolveClose)),
  ]);
  await pool.end();
}

try {
  await initialize(pool);
  server.listen(port,'127.0.0.1');
  await once(server,'listening');
  console.log(`Market API listening on http://127.0.0.1:${port}`);
  if (process.argv.includes('--with-client')) {
    const {createServer:createViteServer} = await import('vite');
    frontend = await createViteServer({
      root:resolve('client'),
      server:{host:'127.0.0.1',strictPort:true,port:Number(process.env.MARKET_CLIENT_PORT??5173)},
    });
    await frontend.listen();
    frontend.printUrls();
  }
  process.once('SIGINT',()=>void close());
  process.once('SIGTERM',()=>void close());
} catch(error) {
  console.error(error);
  await close();
  process.exitCode=1;
}
