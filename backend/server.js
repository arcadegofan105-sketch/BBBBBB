import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Фронт лежит в backend/public
const PUBLIC_DIR = path.join(__dirname, "public");

console.log("PUBLIC_DIR:", PUBLIC_DIR);

app.use(express.static(PUBLIC_DIR));

// ===== API (без авторизации, локальная работа) =====

// In-memory storage
const users = new Map();
function getUser(id = "test-user") {
  if (!users.has(id)) {
    users.set(id, {
      balance: 5,
      inventory: [],
    });
  }
  return users.get(id);
}

app.post("/api/me", (req, res) => {
  const u = getUser();
  res.json({ balance: u.balance, inventory: u.inventory });
});

app.post("/api/spin", (req, res) => {
  const u = getUser();
  
  // Бесплатный спин
  const prizes = [
    { emoji: "🧸", name: "Мишка", price: 0.1 },
    { emoji: "🐸", name: "Пепе", price: 0.0 },
    { emoji: "💋", name: "Губы", price: 0.0 },
    { emoji: "📅", name: "Календарь", price: 1.5 },
    { emoji: "🍀", name: "Клевер", price: 0.0 },
    { emoji: "🍑", name: "Слива", price: 0.0 },
  ];
  
  const prize = prizes[Math.floor(Math.random() * prizes.length)];
  res.json({ prize, newBalance: u.balance });
});

app.post("/api/prize/keep", (req, res) => {
  const u = getUser();
  const prize = req.body?.prize;
  
  if (!prize) {
    return res.status(400).json({ error: "prize required" });
  }
  
  u.inventory.push(prize);
  res.json({ ok: true, inventory: u.inventory });
});

app.post("/api/prize/sell", (req, res) => {
  const u = getUser();
  const prize = req.body?.prize;
  
  if (!prize) {
    return res.status(400).json({ error: "prize required" });
  }
  
  const price = Number(prize.price || 0);
  u.balance = Number((u.balance + price).toFixed(2));
  
  const idx = u.inventory.findIndex(
    i => i.name === prize.name && i.emoji === prize.emoji
  );
  if (idx >= 0) u.inventory.splice(idx, 1);
  
  res.json({ newBalance: u.balance, inventory: u.inventory });
});

app.post("/api/promo/apply", (req, res) => {
  const u = getUser();
  const code = String(req.body?.code || "").trim();
  
  if (!code) {
    return res.status(400).json({ error: "Введите промокод" });
  }
  
  // Простые промокоды
  const promos = {
    "TEST": 1.0,
    "FREE": 5.0,
  };
  
  const amount = promos[code];
  if (!amount) {
    return res.status(400).json({ error: "Промокод не найден" });
  }
  
  u.balance = Number((u.balance + amount).toFixed(2));
  res.json({ newBalance: u.balance, amount });
});

app.post("/api/crash/bet", (req, res) => {
  const u = getUser();
  const amount = Number(req.body?.amount || 0);
  
  if (u.balance < amount) {
    return res.status(400).json({ error: "Недостаточно средств" });
  }
  
  u.balance = Number((u.balance - amount).toFixed(2));
  res.json({ newBalance: u.balance });
});

app.post("/api/crash/cashout", (req, res) => {
  const u = getUser();
  const amount = Number(req.body?.amount || 0);
  
  u.balance = Number((u.balance + amount).toFixed(2));
  res.json({ newBalance: u.balance });
});

// Fallback: любые не-API роуты -> index.html
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not Found" });
  }
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📂 Serving files from: ${PUBLIC_DIR}`);
});
