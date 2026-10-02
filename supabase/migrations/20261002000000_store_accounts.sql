create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  price numeric(8,2) not null check (price between 50 and 500),
  image text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
revoke all on public.accounts from anon, authenticated;
grant select on public.accounts to anon, authenticated;

drop policy if exists "Public can view account catalog" on public.accounts;
create policy "Public can view account catalog"
  on public.accounts for select to anon, authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('account-images', 'account-images', true, 3145728, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Upload e remoção passam pela API do servidor usando a chave secreta do Supabase.
-- Essa chave nunca deve ser colocada no JavaScript público.
