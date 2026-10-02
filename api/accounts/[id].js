const { send, requireOwner, supabase, removeImage } = require("../../lib/production-api");

module.exports = async (req, res) => {
  if (req.method !== "DELETE") return send(res, 405, { error: "Método não permitido." });
  if (!requireOwner(req, res)) return;
  try {
    const id = String(req.query.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 404, { error: "Conta não encontrada." });
    const rows = await supabase(`/rest/v1/accounts?id=eq.${encodeURIComponent(id)}&select=id,image`);
    if (!rows.length) return send(res, 404, { error: "Conta não encontrada." });
    await supabase(`/rest/v1/accounts?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    await removeImage(rows[0].image);
    return send(res, 200, { deleted: true });
  } catch (error) {
    console.error("Falha ao remover conta:", error.message);
    return send(res, 503, { error: "Não foi possível remover a conta. Tente novamente." });
  }
};
