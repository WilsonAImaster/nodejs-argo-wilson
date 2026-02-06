const express = require("express");
const app = express();
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");

// 1. 嚴格讀取環境變數 (Strict Environment Variable Check)
// ⚠️ 如果沒有設定這些變數，程式會直接崩潰，保護您的安全
const ARGO_AUTH = process.env.ARGO_AUTH;
const PORT = process.env.PORT || 3000;

if (!ARGO_AUTH) {
  console.error("❌ 嚴重錯誤：未偵測到 ARGO_AUTH 環境變數！");
  console.error("🛡️ 為了安全，程式已拒絕啟動。請至部署平台 (Render/Railway) 設定環境變數。");
  process.exit(1);
}

// 2. 建立簡單的 Web Server (Keep-Alive)
app.get("/", (req, res) => {
  res.send("Welcome to Wilson's Secure Tunnel. Service is running safely.");
});

app.listen(PORT, () => {
  console.log(`✅ Web 伺服器已啟動，監聽 Port: ${PORT}`);
});

// 3. 下載並啟動 Cloudflared (Argo Tunnel)
const cloudflaredPath = path.join("/tmp", "cloudflared");

function startArgo() {
  console.log("🚀 正在準備啟動 Argo Tunnel...");

  // 判斷系統架構 (AMD64 或 ARM64)
  const arch = process.arch === "arm64" ? "arm64" : "amd64";
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}`;

  console.log(`⬇️ 正在下載官方 Cloudflared Binary (${arch})...`);
  
  const file = fs.createWriteStream(cloudflaredPath);
  https.get(url, (response) => {
    response.pipe(file);
    file.on("finish", () => {
      file.close();
      console.log("✅ 下載完成，賦予執行權限...");
      
      exec(`chmod +x ${cloudflaredPath}`, (err) => {
        if (err) {
          console.error(`❌ 權限設定失敗: ${err}`);
          return;
        }

        console.log("🔗 正在連線至 Cloudflare Edge...");
        // 使用 Token 啟動 Tunnel
        const cmd = `${cloudflaredPath} tunnel --edge-ip-version auto --protocol http2 run --token ${ARGO_AUTH}`;
        
        const tunnel = exec(cmd);

        tunnel.stdout.on("data", (data) => {
          console.log(`[Argo Info]: ${data}`);
        });

        tunnel.stderr.on("data", (data) => {
          console.log(`[Argo Log]: ${data}`);
        });

        tunnel.on("close", (code) => {
          console.log(`⚠️ Argo Tunnel 已停止，退出碼: ${code}`);
        });
      });
    });
  }).on("error", (err) => {
    console.error(`❌ 下載 Cloudflared 失敗: ${err.message}`);
  });
}

// 啟動 Tunnel
startArgo();
