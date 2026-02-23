const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "cards.json");
const PORT = Number(process.env.PORT || 8080);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

ensureDataFile();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith("/api/cards")) {
      await handleApi(req, res, pathname);
      return;
    }

    serveStatic(req, res, pathname);
  } catch (error) {
    json(res, 500, { error: "服务器内部错误", detail: String(error.message || error) });
  }
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`端口 ${PORT} 已被占用。可改用: PORT=8091 node server.js`);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

function readCards() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

function writeCards(cards) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(cards, null, 2), "utf8");
}

async function handleApi(req, res, pathname) {
  const method = req.method || "GET";
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 2) {
    if (method === "GET") {
      const cards = readCards();
      json(res, 200, cards);
      return;
    }

    if (method === "POST") {
      const body = await readBody(req);
      const cards = readCards();
      const validated = validateCard(body, cards);
      cards.push(validated);
      writeCards(cards);
      json(res, 201, validated);
      return;
    }

    methodNotAllowed(res);
    return;
  }

  if (segments.length === 3) {
    const id = segments[2];
    const cards = readCards();
    const index = cards.findIndex((item) => item.id === id);

    if (method === "GET") {
      if (index === -1) {
        json(res, 404, { error: "卡片不存在" });
        return;
      }
      json(res, 200, cards[index]);
      return;
    }

    if (method === "PUT") {
      if (index === -1) {
        json(res, 404, { error: "卡片不存在" });
        return;
      }
      const body = await readBody(req);
      const validated = validateCard({ ...body, id }, cards, { existingId: id });
      cards[index] = validated;
      writeCards(cards);
      json(res, 200, validated);
      return;
    }

    if (method === "DELETE") {
      if (index === -1) {
        json(res, 404, { error: "卡片不存在" });
        return;
      }
      const removed = cards.splice(index, 1)[0];
      writeCards(cards);
      json(res, 200, { ok: true, removed });
      return;
    }

    methodNotAllowed(res);
    return;
  }

  json(res, 404, { error: "接口不存在" });
}

function validateCard(input, cards, options = {}) {
  const existingId = options.existingId || "";

  const idRaw = String(input.id || "").trim();
  const term = String(input.term || "").trim();
  const category = String(input.category || "").trim();
  const core = String(input.core || "").trim();
  const boundary = String(input.boundary || "").trim();
  const signal = String(input.signal || "").trim();
  const action = String(input.action || "").trim();

  if (!term || !category || !core || !boundary || !signal || !action) {
    throw new Error("term/category/core/boundary/signal/action 均为必填");
  }

  const aliases = Array.isArray(input.aliases)
    ? input.aliases.map((item) => String(item).trim()).filter(Boolean)
    : [];

  let id = idRaw || slugify(term);
  if (!id) {
    id = `card-${Date.now()}`;
  }

  const hasDuplicate = cards.some((item) => item.id === id && item.id !== existingId);
  if (hasDuplicate) {
    throw new Error(`卡片 id 已存在: ${id}`);
  }

  return {
    id,
    term,
    category,
    core,
    boundary,
    signal,
    action,
    aliases,
  };
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function serveStatic(req, res, pathname) {
  let filePath = pathname;

  if (filePath === "/") {
    filePath = "/index.html";
  } else if (filePath === "/admin") {
    filePath = "/admin.html";
  } else if (filePath === "/roadmap") {
    filePath = "/roadmap.html";
  } else if (filePath === "/lecture0") {
    filePath = "/lecture0.html";
  } else if (filePath === "/lecture1") {
    filePath = "/lecture1.html";
  } else if (filePath === "/lecture2") {
    filePath = "/lecture2.html";
  } else if (filePath === "/lecture3") {
    filePath = "/lecture3.html";
  } else if (filePath === "/lecture4") {
    filePath = "/lecture4.html";
  } else if (filePath === "/lecture5") {
    filePath = "/lecture5.html";
  } else if (filePath === "/lecture6") {
    filePath = "/lecture6.html";
  }

  const normalized = path.normalize(filePath).replace(/^([.][.][\/])+/, "");
  const absolutePath = path.resolve(path.join(ROOT, normalized));

  if (!absolutePath.startsWith(path.resolve(ROOT))) {
    json(res, 403, { error: "禁止访问" });
    return;
  }

  fs.readFile(absolutePath, (error, content) => {
    if (error) {
      const status = error.code === "ENOENT" ? 404 : 500;
      const msg = status === 404 ? "Not Found" : "Internal Error";
      res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(msg);
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const type = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": type,
    });
    res.end(content);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("请求体过大"));
      }
    });

    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("请求体不是合法 JSON"));
      }
    });

    req.on("error", reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(JSON.stringify(data));
}

function methodNotAllowed(res) {
  json(res, 405, { error: "Method Not Allowed" });
}
