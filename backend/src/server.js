require("dotenv").config();
const express = require("express");
const path = require("path");
const apiRoutes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api", apiRoutes);

// 前端就是 ../kaso（clone 下來的 GitHub repo），單一 index.html 的靜態頁面。
const FRONTEND_DIR = path.join(__dirname, "..", "..", "kaso");
app.use(express.static(FRONTEND_DIR));
app.get("/", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));

app.listen(PORT, () => {
  console.log(`KASO backend + frontend 已啟動： http://localhost:${PORT}`);
});
