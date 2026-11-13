const fs = require("fs");
const net = require("net");
const http = require("http");

const expression = `
(function() {
  const chips = Array.from(document.querySelectorAll('button')).filter(b => 
    b.textContent.includes('Fastest pickup now') || 
    b.textContent.includes('Meal deals today') ||
    b.textContent.includes('Where is my order?')
  );
  if (chips.length > 0) {
    chips[0].click();
    return 'CLICKED_CHIP: ' + chips[0].textContent;
  }
  const input = document.querySelector('input[placeholder*=\"FIF AI\"]') || document.querySelector('input[type=\"text\"]');
  if (input) {
    input.value = 'What meal deals are available today?';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const form = input.closest('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      return 'SUBMITTED_FORM';
    }
  }
  return 'NO_CHIP_OR_INPUT';
})();
`;

const savePath = "C:/Users/keyaa/.gemini/antigravity/brain/2527b1c3-34a7-4ba6-9bee-baa383abe50a/screen_fif_ai_chat.png";

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
          sendFrame({ id: 10, method: "Runtime.evaluate", params: { expression, awaitPromise: true } });
        }
      }

      if (upgraded) {
        const str = buffer.toString("binary");
        if (evalSent && !screenshotSent && (str.includes('"id":10') || str.includes('"id": 10'))) {
          console.log("Prompt sent to FIF AI. Waiting 4.5s for streaming/AI response...");
          screenshotSent = true;
          buffer = Buffer.alloc(0);
          setTimeout(() => {
            sendFrame({ id: 20, method: "Page.captureScreenshot", params: { format: "png" } });
          }, 4500);
          return;
        }

        if (screenshotSent) {
          const idx = str.indexOf('"data":"');
          if (idx !== -1) {
            const end = str.indexOf('"', idx + 8);
            if (end !== -1) {
              const b64 = str.substring(idx + 8, end);
              fs.writeFileSync(savePath, Buffer.from(b64, "base64"));
              console.log("SUCCESS saved to", savePath, "Bytes:", b64.length);
              socket.end();
              process.exit(0);
            }
          }
        }
      }
    });
  });
});
