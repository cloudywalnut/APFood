const fs = require("fs");
const net = require("net");
const http = require("http");

function evaluateAndCapture(url, expr, outputPath, waitMs = 2500) {
  return new Promise((resolve, reject) => {
    http.get("http://127.0.0.1:9222/json/list", (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        const list = JSON.parse(data);
        const id = list[0].id;
        const socket = net.createConnection(9222, "127.0.0.1", () => {
          socket.write("GET /devtools/page/" + id + " HTTP/1.1\r\nHost: 127.0.0.1:9222\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n");
        });

        let buffer = Buffer.alloc(0);
        let upgraded = false;
        let step = 0;

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
            if (url) {
              step = 1;
              sendFrame({ id: 1, method: "Page.navigate", params: { url } });
            } else {
              step = 2;
              sendFrame({ id: 2, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true } });
            }
          }

          if (upgraded) {
            const str = buffer.toString("binary");
            if (step === 1 && str.includes('"id":1')) {
              step = 2;
              buffer = Buffer.alloc(0);
              setTimeout(() => {
                if (expr) {
                  sendFrame({ id: 2, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true } });
                } else {
                  step = 3;
                  sendFrame({ id: 3, method: "Page.captureScreenshot", params: { format: "png" } });
                }
              }, waitMs);
              return;
            }

            if (step === 2 && str.includes('"id":2')) {
              step = 3;
              buffer = Buffer.alloc(0);
              setTimeout(() => {
                sendFrame({ id: 3, method: "Page.captureScreenshot", params: { format: "png" } });
              }, 1000);
              return;
            }

            if (step === 3) {
              const idx = str.indexOf('"data":"');
              if (idx !== -1) {
                const end = str.indexOf('"', idx + 8);
                if (end !== -1) {
                  const b64 = str.substring(idx + 8, end);
                  fs.writeFileSync(outputPath, Buffer.from(b64, "base64"));
                  console.log("SUCCESS saved", outputPath, "Bytes:", b64.length);
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
  console.log("Navigating to Chinese stall menu...");
  await evaluateAndCapture("https://apfoods.vercel.app/app/vendors", `
    (function() {
      const stallLink = Array.from(document.querySelectorAll('a')).find(a => a.href && a.href.includes('/vendors/'));
      if (stallLink) stallLink.click();
    })();
  `, "docs/screenshots/mobile-menu.png", 3000);

  console.log("Navigating to cart & scheduled order...");
  await evaluateAndCapture("https://apfoods.vercel.app/app/cart", null, "docs/screenshots/mobile-cart.png", 3000);

  console.log("Done mobile captures!");
}

run();
