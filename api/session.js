const { send, hasOwnerSession } = require("../lib/production-api");

module.exports = (req, res) => {
  if (req.method !== "GET") return send(res, 405, { error: "Método não permitido." });
  try { return send(res, 200, { authenticated: hasOwnerSession(req) }); }
  catch { return send(res, 503, { error: "Painel ainda não configurado na hospedagem." }); }
};
