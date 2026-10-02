const { send, requireOwner, clearSession } = require("../lib/production-api");

module.exports = (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  if (!requireOwner(req, res)) return;
  clearSession(res);
  return send(res, 200, { authenticated: false });
};
