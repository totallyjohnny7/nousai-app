import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'output');

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const file = path.join(dir, req.url.slice(1));
  if (fs.existsSync(file) && file.endsWith('.json')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    fs.createReadStream(file).pipe(res);
  } else {
    res.writeHead(404); res.end('not found');
  }
}).listen(7788, () => console.log('ready on 7788'));
