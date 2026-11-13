const fs = require("fs");
const net = require("net");
const http = require("http");

const tab = process.argv[2] || "stalls";
const savePath = process.argv[3] || "docs/screenshots/mobile-stalls.png";
const waitTime = parseInt(process.argv[4] || "3000", 10);

http.get("http://127.0.0.1:9222/json/list", (res) => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => {
    const list = JSON.parse(data);
    const id = list[0].id;
    const path = "/devtools/page/" + id;
    
    const socket = net.createConnection(9222, "127.0.0.1", () => {
      socket.write("GET " + path + " HTTP/1.1\r\n" +
                   "Host: 127.0.0.1:9222\r\n" +
                   "Upgrade: websocket\r\n" +
                   "Connection: Upgrade\r\n" +
                   "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n" +
                   "Sec-WebSocket-Version: 13\r\n\r\n");
    });

    let buffer = Buffer.alloc(0);
    let upgraded = false;
    let evalSent = false;
    let screenshotSent = false;

    function sendFrame(msgObj) {
      const msg = JSON.stringify(msgObj);
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

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      
      if (!upgraded) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          upgraded = true;
          buffer = buffer.slice(headerEnd + 4);
          evalSent = true;
          const expr = `
            (function() {
              const navLinks = Array.from(document.querySelectorAll('nav button, nav a'));
              const target = navLinks.find(el => el.textContent.trim().toLowerCase().includes('${tab.toLowerCase()}'));
              if (target) {
                target.click();
                return 'CLICKED_${tab}';
              }
              return 'NOT_FOUND';
            })();
          `;
          sendFrame({ id: 10, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true } });
        }
      }

      if (upgraded) {
        const str = buffer.toString("binary");
        if (evalSent && !screenshotSent && (str.includes('"id":10') || str.includes('"id": 10'))) {
          console.log("Navigated to " + tab + ", waiting " + waitTime + "ms for rendering...");
          screenshotSent = true;
          buffer = Buffer.alloc(0);
          setTimeout(() => {
            sendFrame({ id: 20, method: "Page.captureScreenshot", params: { format: "png" } });
          }, waitTime);
          return;
        }

        if (screenshotSent) {
          const idx = str.indexOf('"data":"');
          if (idx !== -1) {
            const end = str.indexOf('"', idx + 8);
            if (end !== -1) {
              const b64 = str.substring(idx + 8, end);
              fs.writeFileSync(savePath, Buffer.from(b64, "base64"));
              console.log("Saved", savePath);
              socket.end();
              process.exit(0);
            }
          }
        }
      }
    });
  });
});
