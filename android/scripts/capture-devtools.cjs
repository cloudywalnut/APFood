const fs = require("fs");
const net = require("net");
const http = require("http");

http.get("http://127.0.0.1:9222/json/list", (res) => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => {
    const list = JSON.parse(data);
    const id = list[0].id;
    const path = "/devtools/page/" + id;
    
    const socket = net.createConnection(9222, "127.0.0.1", () => {
      const req = "GET " + path + " HTTP/1.1\r\n" +
                  "Host: 127.0.0.1:9222\r\n" +
                  "Upgrade: websocket\r\n" +
                  "Connection: Upgrade\r\n" +
                  "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n" +
                  "Sec-WebSocket-Version: 13\r\n\r\n";
      socket.write(req);
    });

    let buffer = Buffer.alloc(0);
    let upgraded = false;

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      
      if (!upgraded) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          upgraded = true;
          buffer = buffer.slice(headerEnd + 4);
          
          const msg = JSON.stringify({ id: 1, method: "Page.captureScreenshot", params: { format: "png" } });
          const len = Buffer.byteLength(msg);
          let frame;
          if (len < 126) {
            frame = Buffer.concat([Buffer.from([0x81, 0x80 | len, 0x12, 0x34, 0x56, 0x78]), Buffer.alloc(len)]);
            for (let i = 0; i < len; i++) frame[6 + i] = Buffer.from(msg)[i] ^ frame[2 + (i % 4)];
          } else {
            frame = Buffer.concat([Buffer.from([0x81, 0x80 | 126, (len >> 8) & 0xff, len & 0xff, 0x12, 0x34, 0x56, 0x78]), Buffer.alloc(len)]);
            for (let i = 0; i < len; i++) frame[8 + i] = Buffer.from(msg)[i] ^ frame[4 + (i % 4)];
          }
          socket.write(frame);
        }
      }

      if (upgraded) {
        const str = buffer.toString("binary");
        const idx = str.indexOf('"data":"');
        if (idx !== -1) {
          const end = str.indexOf('"', idx + 8);
          if (end !== -1) {
            const b64 = str.substring(idx + 8, end);
            const target = process.argv[2] || "C:/Users/keyaa/.gemini/antigravity/brain/2527b1c3-34a7-4ba6-9bee-baa383abe50a/screen_webview.png";
            fs.writeFileSync(target, Buffer.from(b64, "base64"));
            console.log("Saved screenshot to", target, "Bytes:", b64.length);
            socket.end();
            process.exit(0);
          }
        }
      }
    });
  });
});
