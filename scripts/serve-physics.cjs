const http = require('http');
const fs = require('fs');
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  fs.createReadStream('C:/Users/johnn/Desktop/NousAI-App/scripts/output/merged-all.json').pipe(res);
}).listen(7823, () => console.log('ready'));
