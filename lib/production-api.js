const crypto = require("node:crypto");

const SESSION_COOKIE = "xtb_owner_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=85";

function send(res, status, payload) {
  res.status(status).setHeader("Cache-Control", "no-store").setHeader("X-Content-Type-Options", "nosniff").json(payload);
}

function config() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, XT_ADMIN_PASSWORD, XT_SESSION_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !XT_ADMIN_PASSWORD || XT_ADMIN_PASSWORD.length < 12 || !XT_SESSION_SECRET || XT_SESSION_SECRET.length < 32) {
    throw new Error("Configuração de produção incompleta. Verifique as variáveis de ambiente no painel da hospedagem.");
  }
  return { url: SUPABASE_URL.replace(/\/$/, ""), key: SUPABASE_SECRET_KEY, password: XT_ADMIN_PASSWORD, sessionSecret: XT_SESSION_SECRET };
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  return !origin || new URL(origin).host === req.headers.host;
}

function cookieValue(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map((part) => {
    const [name, ...value] = part.trim().split("=");
    return [name, value.join("=")];
  }))[SESSION_COOKIE];
}

function signature(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function hasOwnerSession(req) {
  const { sessionSecret } = config();
  const token = cookieValue(req);
  if (!token) return false;
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return false;
  const expected = signature(payload, sessionSecret);
  const left = Buffer.from(suppliedSignature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).expiresAt > Date.now();
  } catch {
    return false;
  }
}

function setSession(res) {
  const { sessionSecret } = config();
  const payload = Buffer.from(JSON.stringify({ expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000, nonce: crypto.randomBytes(16).toString("hex") })).toString("base64url");
  const token = `${payload}.${signature(payload, sessionSecret)}`;
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=${SESSION_TTL_SECONDS}`);
}

function clearSession(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0`);
}

function requireOwner(req, res) {
  if (!sameOrigin(req)) {
    send(res, 403, { error: "Origem não permitida." });
    return false;
  }
  if (!hasOwnerSession(req)) {
    send(res, 401, { error: "Faça login como dono da loja." });
    return false;
  }
  return true;
}

async function supabase(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Falha no armazenamento (${response.status}): ${body.slice(0, 240)}`);
  return body ? JSON.parse(body) : null;
}

function parseImage(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
  let extension;
  let mime;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) [extension, mime] = ["png", "image/png"];
  else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) [extension, mime] = ["jpg", "image/jpeg"];
  else if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") [extension, mime] = ["webp", "image/webp"];
  else if (["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) [extension, mime] = ["gif", "image/gif"];
  return extension ? { buffer, extension, mime } : null;
}

async function uploadImage(dataUrl) {
  const image = parseImage(dataUrl);
  if (!image) throw new Error("Envie PNG, JPEG, WebP ou GIF de até 3 MB.");
  const path = `${crypto.randomUUID()}.${image.extension}`;
  const { url, key } = config();
  const response = await fetch(`${url}/storage/v1/object/account-images/${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": image.mime, "x-upsert": "false" },
    body: image.buffer
  });
  if (!response.ok) throw new Error("Não foi possível salvar a imagem no armazenamento. Confira a configuração do bucket.");
  return `${url}/storage/v1/object/public/account-images/${path}`;
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
    try { if (new URL(image).protocol !== "https:") return "A imagem deve usar um endereço HTTPS."; }
    catch { return "Informe um endereço válido para a imagem."; }
  }
  if (body.imageData && !parseImage(body.imageData)) return "Envie PNG, JPEG, WebP ou GIF de até 3 MB.";
  return null;
}

function fromRow(row) {
  return { id: row.id, name: row.name, category: "conta", price: Number(row.price), stock: 1, contactOnly: true, badge: "CONTA DISPONÍVEL", image: row.image, description: row.description };
}

async function removeImage(imageUrl) {
  if (!imageUrl) return;
  const { url } = config();
  const prefix = `${url}/storage/v1/object/public/account-images/`;
  if (!imageUrl.startsWith(prefix)) return;
  const path = imageUrl.slice(prefix.length);
  await supabase("/storage/v1/object/account-images", { method: "DELETE", body: JSON.stringify({ prefixes: [path] }) });
}

module.exports = { send, config, sameOrigin, hasOwnerSession, setSession, clearSession, requireOwner, supabase, uploadImage, validateAccount, fromRow, removeImage, PLACEHOLDER_IMAGE };
