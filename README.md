# XT Brazil Store

## Teste local atual

O servidor local continua usando os arquivos em `data/`. No PowerShell, dentro desta pasta, defina a senha local já configurada na sua máquina e inicie o servidor:

```powershell
$env:XT_ADMIN_PASSWORD = Read-Host "Senha local do painel"
node server.js
```

Abra `http://127.0.0.1:3000`. A senha local não é publicada junto com o site.

## Publicação na Vercel

A versão publicada usa funções de servidor em `api/` e salva o catálogo e as imagens no Supabase. Não use `node server.js` como comando de inicialização na Vercel: a Vercel executa as funções automaticamente e serve os arquivos do site.

### 1. Preparar o Supabase

1. Crie um projeto Supabase e abra **SQL Editor**.
2. Execute o conteúdo de `supabase/migrations/20261002000000_store_accounts.sql`.
3. Em **Project Settings > API Keys**, copie a URL do projeto e uma chave **secret** (`sb_secret_...`). A chave secret só será usada nas funções do servidor.

O bucket de imagens é público para exibição no catálogo. A chave secreta usada para gravar e excluir imagens nunca deve ser exposta ao navegador.

### 2. Configurar a Vercel

Importe o repositório GitHub como um projeto Vercel. Deixe o framework como **Other** e não configure build command nem output directory. Em **Settings > Environment Variables**, configure para **Production** (e Preview, se desejar testar prévias):

| Nome | Valor |
| --- | --- |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SECRET_KEY` | Chave secret `sb_secret_...` do Supabase |
| `XT_ADMIN_PASSWORD` | Nova senha exclusiva com pelo menos 12 caracteres |
| `XT_SESSION_SECRET` | Segredo aleatório com pelo menos 32 caracteres |

Configure os valores secretos diretamente no painel da Vercel; não os coloque em arquivos, no GitHub ou no chat. Depois de salvar as variáveis, faça um novo deploy para aplicá-las.

### 3. Painel do proprietário

O login de produção usa `XT_ADMIN_PASSWORD`, cookie seguro `HttpOnly` e sessão assinada com validade de 12 horas. Cadastros, exclusões e upload de imagens passam pelas funções protegidas do servidor. O visitante pode consultar o catálogo, mas só quem conhece a senha configurada na Vercel pode gerenciá-lo. Defina uma senha de produção com 12 caracteres ou mais antes de publicar.

O painel aceita imagens PNG, JPEG, WebP ou GIF de até 3 MB. Os arquivos são guardados no bucket `account-images` e os dados das contas na tabela `public.accounts`.

## Observações de segurança

- A chave Supabase `sb_secret_...` tem privilégios administrativos e deve existir somente nas variáveis da Vercel.
- Use HTTPS e não compartilhe a senha administrativa.
- A limitação de tentativas de login em memória ajuda em uma única instância; para múltiplas instâncias, configure também rate limiting no firewall/WAF da Vercel.
- A loja não coleta nem armazena credenciais de acesso às contas de jogo. Não inclua senhas, códigos de recuperação ou dados pessoais de terceiros nos anúncios.
