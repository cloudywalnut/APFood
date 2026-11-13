const net = require('net');
const http = require('http');

http.get('http://127.0.0.1:9222/json/list', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const list = JSON.parse(data);
    const id = list[0].id;
    const socket = net.createConnection(9222, '127.0.0.1', () => {
      socket.write('GET /devtools/page/' + id + ' HTTP/1.1\r\nHost: 127.0.0.1:9222\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n');
    });
    let buffer = Buffer.alloc(0);
    let upgraded = false;
    socket.on('data', c => {
      buffer = Buffer.concat([buffer, c]);
      if (!upgraded && buffer.indexOf('\r\n\r\n') !== -1) {
        upgraded = true;
        const msg = JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: 'JSON.stringify({ ua: navigator.userAgent, cap: typeof window.Capacitor, capObj: !!window.Capacitor })',
            returnByValue: true
          }
        });
        const len = Buffer.byteLength(msg);
        const frame = Buffer.concat([Buffer.from([0x81, 0x80 | 126, (len >> 8) & 0xff, len & 0xff, 0x12, 0x34, 0x56, 0x78]), Buffer.alloc(len)]);
        for (let i = 0; i < len; i++) frame[8 + i] = Buffer.from(msg)[i] ^ frame[4 + (i % 4)];
        socket.write(frame);
      }
      if (upgraded && buffer.toString().includes('"id":1')) {
        console.log(buffer.toString('utf8'));
        socket.end();
      }
    });
  });
});
