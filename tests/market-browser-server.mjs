import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import pg from 'pg';
import {initialize} from '../market/database.mjs';
import {handle} from '../market/service.mjs';

const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
await initialize(pool);
const root = resolve('client/dist');
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.jpg': 'image/jpeg'};

createServer(async (incoming, outgoing) => {
  const url = new URL(incoming.url, 'http://127.0.0.1:4175');
  try {
    if (url.pathname.startsWith('/api/market/')) {
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const response = await handle(new Request(url, {method: incoming.method, headers: incoming.headers, body}), pool);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const path = resolve(root, '.' + (extname(url.pathname) ? url.pathname : '/index.html'));
    if (!path.startsWith(root + sep)) {
      outgoing.writeHead(404).end();
      return;
    }
    const file = await readFile(path);
    outgoing.writeHead(200, {'Content-Type': types[extname(path)] || 'application/octet-stream'});
    outgoing.end(file);
  } catch (error) {
    if (error.code === 'ENOENT') outgoing.writeHead(404).end();
    else {
      console.error(error);
      outgoing.writeHead(500).end();
    }
  }
}).listen(4175, '127.0.0.1');
