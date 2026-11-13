const fs = require("fs");
const net = require("net");
const http = require("http");

async function captureTab(tabText, outputName) {
  return new Promise((resolve, reject) => {
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
        let clicked = false;
        let shot = false;

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
          if (!upgraded && buffer.indexOf("\r\n\r\n") !== -1) {
            upgraded = true;
            buffer = buffer.slice(buffer.indexOf("\r\n\r\n") + 4);
            const clickExpr = `
              (function() {
                const navLinks = Array.from(document.querySelectorAll('nav button, nav a'));
                const target = navLinks.find(el => el.textContent.trim().toLowerCase().includes('${tabText.toLowerCase()}'));
                if (target) {
                  target.click();
                  return 'CLICKED_${tabText}';
                }
                return 'NOT_FOUND';
              })();
            `;
            clicked = true;
            sendFrame({ id: 1, method: "Runtime.evaluate", params: { expression: clickExpr, awaitPromise: true } });
          }

          if (upgraded) {
            const str = buffer.toString("binary");
            if (clicked && !shot && str.includes('"id":1')) {
              shot = true;
              buffer = Buffer.alloc(0);
              setTimeout(() => {
                sendFrame({ id: 2, method: "Page.captureScreenshot", params: { format: "png" } });
              }, 1200);
            }

            if (shot) {
              const idx = str.indexOf('"data":"');
              if (idx !== -1) {
                const end = str.indexOf('"', idx + 8);
                if (end !== -1) {
                  const b64 = str.substring(idx + 8, end);
                  fs.writeFileSync(outputName, Buffer.from(b64, "base64"));
                  console.log("Saved", outputName);
                  socket.end();
                  resolve();
                }
              }
            }
          }
        });
      });
    });
  });
}

async function run() {
  await captureTab("Stalls", "docs/screenshots/mobile-stalls.png");
  await new Promise(r => setTimeout(r, 1000));
  await captureTab("Traffic", "docs/screenshots/mobile-traffic.png");
  await new Promise(r => setTimeout(r, 1000));
  await captureTab("Discover", "docs/screenshots/mobile-marketplace.png");
  console.log("ALL TABS CAPTURED!");
}

run();
