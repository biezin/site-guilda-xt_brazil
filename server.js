const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const COOKIE_NAME = "xtb_owner_session";
const PASSWORD = process.env.XT_ADMIN_PASSWORD;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_BODY_BYTES = 6_000_000;
const sessions = new Map();
const loginAttempts = new Map();
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon"
};

const MIN_PASSWORD_LENGTH = IS_PRODUCTION ? 12 : 10;
if (!PASSWORD || PASSWORD.length < MIN_PASSWORD_LENGTH) {
  console.error(`Configure XT_ADMIN_PASSWORD com pelo menos ${MIN_PASSWORD_LENGTH} caracteres antes de iniciar.`);
  process.exit(1);
}

const passwordSalt = "xt-brazil-owner-login-v1";
const passwordHash = crypto.scryptSync(PASSWORD, passwordSalt, 64);

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const [name, ...value] = part.trim().split("=");
    return [name, value.join("=")];
  }).filter(([name]) => name));
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { token, session };
}

function setSessionCookie(res, token) {
  const secure = IS_PRODUCTION ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
}

function clearSessionCookie(res) {
  const secure = IS_PRODUCTION ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

function isSameOrigin(req) {
  if (!req.headers.origin) return true;
  const origin = new URL(req.headers.origin);
  return origin.host === req.headers.host;
}

function requireOwner(req, res) {
  if (!isSameOrigin(req)) {
    json(res, 403, { error: "Origem não permitida." });
    return null;
  }
  const session = getSession(req);
  if (!session) {
    json(res, 401, { error: "Faça login como dono da loja." });
    return null;
  }
  return session;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let totalBytes = 0;
    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      data += chunk;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error("Corpo da solicitação muito grande."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("JSON inválido."));
      }
    });
    req.on("error", reject);
  });
}

async function loadAccounts() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  try {
    const parsed = JSON.parse(await fs.promises.readFile(ACCOUNTS_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await fs.promises.writeFile(ACCOUNTS_FILE, "[]\n", "utf8");
    return [];
  }
}

async function saveAccounts(accounts) {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  const temporaryFile = `${ACCOUNTS_FILE}.tmp`;
  await fs.promises.writeFile(temporaryFile, `${JSON.stringify(accounts, null, 2)}\n`, "utf8");
  await fs.promises.rename(temporaryFile, ACCOUNTS_FILE);
}

function validateAccount(body) {
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const price = Number(body.price);
  const image = String(body.image || "").trim();
  if (!name || name.length > 60) return "Informe um nome com até 60 caracteres.";
  if (!Number.isFinite(price) || price < 50 || price > 500) return "O preço deve ficar entre R$ 50,00 e R$ 500,00.";
  if (description.length > 300) return "A descrição pode ter até 300 caracteres.";
  if (!body.imageData && image) {
    try {
      if (new URL(image).protocol !== "https:") return "A imagem deve usar um endereço HTTPS.";
    } catch {
      return "Informe um endereço válido para a imagem.";
    }
  }
  if (body.imageData && !parseImageUpload(body.imageData)) return "Envie uma imagem PNG, JPEG, WebP ou GIF de até 4 MB.";
  return null;
}

function parseImageUpload(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) return null;
  let extension;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) extension = "png";
  else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) extension = "jpg";
  else if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") extension = "webp";
  else if (["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) extension = "gif";
  if (!extension) return null;
  return { buffer, extension };
}

async function saveAccountImage(dataUrl) {
  const upload = parseImageUpload(dataUrl);
  if (!upload) throw new Error("Imagem inválida.");
  const imageDirectory = path.join(DATA_DIR, "account-images");
  await fs.promises.mkdir(imageDirectory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${upload.extension}`;
  await fs.promises.writeFile(path.join(imageDirectory, filename), upload.buffer, { flag: "wx" });
  return `/account-images/${filename}`;
}

function serveStatic(req, res, pathname) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  } catch {
    res.writeHead(400).end("Endereço inválido.");
    return;
  }

  const target = path.resolve(ROOT, `.${relativePath}`);
  const allowedRoots = ["index.html", "css", "js", "assets"];
  const relativeTarget = path.relative(ROOT, target);
  const rootName = relativeTarget.split(path.sep)[0];
  if (!relativeTarget || relativeTarget.startsWith("..") || !allowedRoots.includes(rootName)) {
    res.writeHead(404).end("Não encontrado.");
    return;
  }

  fs.createReadStream(target)
    .on("error", () => res.writeHead(404).end("Não encontrado."))
    .on("open", () => {
      res.setHeader("Content-Type", MIME_TYPES[path.extname(target).toLowerCase()] || "application/octet-stream");
      res.setHeader("X-Content-Type-Options", "nosniff");
    })
    .pipe(res);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  try {
    if (pathname === "/api/session" && req.method === "GET") {
      json(res, 200, { authenticated: Boolean(getSession(req)) });
      return;
    }

    if (pathname === "/api/login" && req.method === "POST") {
      if (!isSameOrigin(req)) {
        json(res, 403, { error: "Origem não permitida." });
        return;
      }
      const client = req.socket.remoteAddress || "unknown";
      const attempts = loginAttempts.get(client) || { count: 0, blockedUntil: 0 };
      if (attempts.blockedUntil > Date.now()) {
        json(res, 429, { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." });
        return;
      }
      const body = await readBody(req);
      const submittedHash = crypto.scryptSync(String(body.password || ""), passwordSalt, 64);
      if (!crypto.timingSafeEqual(submittedHash, passwordHash)) {
        attempts.count += 1;
        if (attempts.count >= 5) {
          attempts.count = 0;
          attempts.blockedUntil = Date.now() + 15 * 60 * 1000;
        }
        loginAttempts.set(client, attempts);
        json(res, 401, { error: "Senha incorreta." });
        return;
      }
      loginAttempts.delete(client);
      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
      setSessionCookie(res, token);
      json(res, 200, { authenticated: true });
      return;
    }

    if (pathname === "/api/logout" && req.method === "POST") {
      const owner = requireOwner(req, res);
      if (!owner) return;
      sessions.delete(owner.token);
      clearSessionCookie(res);
      json(res, 200, { authenticated: false });
      return;
    }

    if (pathname === "/api/accounts" && req.method === "GET") {
      json(res, 200, { accounts: await loadAccounts() });
      return;
    }

    if (pathname === "/api/accounts" && req.method === "POST") {
      if (!requireOwner(req, res)) return;
      const body = await readBody(req);
      const validationError = validateAccount(body);
      if (validationError) {
        json(res, 400, { error: validationError });
        return;
      }
      const imagePath = body.imageData
        ? await saveAccountImage(body.imageData)
        : String(body.image || "").trim() || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=85";
      const account = {
        id: crypto.randomUUID(),
        name: String(body.name).trim(),
        category: "conta",
        price: Number(body.price),
        stock: 1,
        contactOnly: true,
        badge: "CONTA DISPONÍVEL",
        image: imagePath,
        description: String(body.description || "").trim() || "Conta disponível. Chame no WhatsApp para receber os detalhes do inventário."
      };
      const accounts = await loadAccounts();
      accounts.push(account);
      await saveAccounts(accounts);
      json(res, 201, { account });
      return;
    }

    const accountId = pathname.match(/^\/api\/accounts\/([\w-]+)$/)?.[1];
    if (accountId && req.method === "DELETE") {
      if (!requireOwner(req, res)) return;
      const accounts = await loadAccounts();
      const remaining = accounts.filter((account) => account.id !== accountId);
      if (remaining.length === accounts.length) {
        json(res, 404, { error: "Conta não encontrada." });
        return;
      }
      await saveAccounts(remaining);
      json(res, 200, { deleted: true });
      return;
    }

    const accountImage = pathname.match(/^\/account-images\/([0-9a-f-]{36}\.(?:png|jpg|webp|gif))$/i)?.[1];
    if (accountImage && req.method === "GET") {
      const imagePath = path.join(DATA_DIR, "account-images", accountImage);
      res.setHeader("Content-Type", MIME_TYPES[path.extname(imagePath)] || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      fs.createReadStream(imagePath).on("error", () => {
        if (!res.headersSent) res.writeHead(404).end("Imagem não encontrada.");
        else res.end();
      }).pipe(res);
      return;
    }

    if (pathname.startsWith("/api/")) {
      json(res, 404, { error: "Rota não encontrada." });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end("Método não permitido.");
      return;
    }
    serveStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: "Erro interno do servidor." });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`XT Brazil disponível em http://${HOST}:${PORT}`);
});
