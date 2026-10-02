const crypto = require("node:crypto");
const { send, config, sameOrigin, setSession } = require("../lib/production-api");

const failures = new Map();
module.exports = (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  if (!sameOrigin(req)) return send(res, 403, { error: "Origem não permitida." });
  try {
    const settings = config();
    const address = String(req.headers["x-forwarded-for"] || "desconhecido").split(",")[0].trim();
    const entry = failures.get(address) || { count: 0, blockedUntil: 0 };
    if (entry.blockedUntil > Date.now()) return send(res, 429, { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." });
    const provided = Buffer.from(String(req.body?.password || ""));
    const expected = Buffer.from(settings.password);
    const matches = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
    if (!matches) {
      entry.count += 1;
      if (entry.count >= 5) { entry.count = 0; entry.blockedUntil = Date.now() + 15 * 60 * 1000; }
      failures.set(address, entry);
      return send(res, 401, { error: "Senha incorreta." });
    }
    failures.delete(address);
    setSession(res);
    return send(res, 200, { authenticated: true });
  } catch {
    return send(res, 503, { error: "Painel ainda não configurado na hospedagem." });
  }
};
