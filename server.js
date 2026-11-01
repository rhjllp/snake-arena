const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "replace-this-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: "auto", maxAge: 1000 * 60 * 60 * 24 }
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

// DEMO STORAGE: memory only. Accounts/scores reset whenever this server restarts.
// Add a persistent database (e.g. PostgreSQL) before using this for a real public game.
const users = new Map();
const online = new Map();
let nextId = 1;

function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role, score: user.score, banned: user.banned };
}
function currentUser(req) {
  return req.session.userId ? users.get(req.session.userId) : null;
}
function requireLogin(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập." });
  if (user.banned) return res.status(403).json({ error: "Tài khoản đã bị khóa." });
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "Bạn không có quyền admin." });
  next();
}

// Create the first admin from Render environment variables.
// Never put the admin password directly in public frontend code.
async function createConfiguredAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.log("Admin chưa được tạo: hãy đặt ADMIN_USERNAME và ADMIN_PASSWORD trong Environment.");
    return;
  }
  if ([...users.values()].some(u => u.role === "admin")) return;
  const user = {
    id: String(nextId++), username: String(username).trim().toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role: "admin", score: 0, banned: false, createdAt: new Date().toISOString()
  };
  users.set(user.id, user);
  console.log("Đã tạo tài khoản admin từ Environment.");
}

app.get("/api/me", (req, res) => {
  const user = currentUser(req);
  res.json({ user: user && !user.banned ? publicUser(user) : null });
});

app.post("/api/register", async (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!/^[a-z0-9_]{3,16}$/.test(username))
    return res.status(400).json({ error: "Tên tài khoản phải 3–16 ký tự, chỉ gồm a-z, số và dấu _." });
  if (password.length < 8 || password.length > 72)
    return res.status(400).json({ error: "Mật khẩu cần từ 8 đến 72 ký tự." });
  if ([...users.values()].some(u => u.username === username))
    return res.status(409).json({ error: "Tên tài khoản đã tồn tại." });
  const user = {
    id: String(nextId++), username, passwordHash: await bcrypt.hash(password, 12),
    role: "player", score: 0, banned: false, createdAt: new Date().toISOString()
  };
  users.set(user.id, user);
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post("/api/login", async (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = [...users.values()].find(u => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: "Tên tài khoản hoặc mật khẩu không đúng." });
  if (user.banned) return res.status(403).json({ error: "Tài khoản đã bị khóa." });
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.post("/api/score", requireLogin, (req, res) => {
  const score = Number(req.body.score);
  // Basic sanity cap for this demo. A production game must validate gameplay server-side.
  if (!Number.isInteger(score) || score < 0 || score > 100000)
    return res.status(400).json({ error: "Điểm không hợp lệ." });
  req.user.score = Math.max(req.user.score, score);
  res.json({ bestScore: req.user.score });
});

app.get("/api/leaderboard", (req, res) => {
  const top = [...users.values()]
    .filter(u => !u.banned && u.role !== "admin")
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(u => ({ username: u.username, score: u.score }));
  res.json({ leaderboard: top });
});

app.get("/api/admin/overview", requireLogin, requireAdmin, (req, res) => {
  const all = [...users.values()];
  res.json({
    totalUsers: all.filter(u => u.role !== "admin").length,
    online: online.size,
    users: all.map(u => ({ ...publicUser(u), createdAt: u.createdAt, isOnline: online.has(u.id) }))
  });
});

app.post("/api/admin/user/:id/ban", requireLogin, requireAdmin, (req, res) => {
  const target = users.get(req.params.id);
  if (!target || target.role === "admin") return res.status(404).json({ error: "Không tìm thấy người chơi." });
  target.banned = !target.banned;
  for (const [socketId, userId] of online.entries()) {
    if (userId === target.id) {
      const s = io.sockets.sockets.get(socketId);
      if (s) s.disconnect(true);
    }
  }
  res.json({ user: publicUser(target) });
});

io.on("connection", socket => {
  const userId = socket.request.session.userId;
  const user = userId && users.get(userId);
  if (!user || user.banned) return socket.disconnect(true);
  online.set(socket.id, user.id);
  io.emit("onlineCount", online.size);
  socket.on("disconnect", () => {
    online.delete(socket.id);
    io.emit("onlineCount", online.size);
  });
});

createConfiguredAdmin().then(() => {
  server.listen(PORT, "0.0.0.0", () => console.log(`Snake server listening on ${PORT}`));
});