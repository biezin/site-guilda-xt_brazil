const { send, requireOwner, supabase, uploadImage, validateAccount, fromRow, PLACEHOLDER_IMAGE } = require("../../lib/production-api");

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const rows = await supabase("/rest/v1/accounts?select=id,name,price,image,description&order=created_at.desc");
      return send(res, 200, { accounts: rows.map(fromRow) });
    }
    if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
    if (!requireOwner(req, res)) return;
    const body = req.body || {};
    const error = validateAccount(body);
    if (error) return send(res, 400, { error });
    const image = body.imageData ? await uploadImage(body.imageData) : String(body.image || "").trim() || PLACEHOLDER_IMAGE;
    const [row] = await supabase("/rest/v1/accounts", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name: String(body.name).trim(), price: Number(body.price), image, description: String(body.description || "").trim() || "Conta disponível. Chame no WhatsApp para receber os detalhes do inventário." }) });
    return send(res, 201, { account: fromRow(row) });
  } catch (error) {
    console.error("Falha na API de contas:", error.message);
    return send(res, 503, { error: "Não foi possível acessar o catálogo. Verifique a configuração do Supabase." });
  }
};

module.exports.config = { api: { bodyParser: { sizeLimit: "5mb" } } };
