require("dotenv").config();
const express = require("express");
const path = require("path");
const apiRoutes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api", apiRoutes);

// 前端 index.html 就在這個 repo 的根目錄（backend/ 是它的子目錄）。
// 故意不用 express.static 整個目錄——那樣會把 backend/.env、原始碼一起經由 HTTP 暴露出去。
// index.html 是完全自包含的單一檔案（inline CSS/JS），沒有其他外部資源，只需要開這一個路由。
const FRONTEND_INDEX = path.join(__dirname, "..", "..", "index.html");
app.get("/", (req, res) => res.sendFile(FRONTEND_INDEX));

app.listen(PORT, () => {
  console.log(`KASO backend + frontend 已啟動： http://localhost:${PORT}`);
});
