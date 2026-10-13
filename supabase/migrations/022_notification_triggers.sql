-- 022: novi okidači obavještenja (novi kvar, popravka čeka odobrenje, dnevni pregled rokova)
alter table public.webhook_settings add column if not exists trigger_new_damage boolean default true;
alter table public.webhook_settings add column if not exists trigger_repair_awaiting_approval boolean default true;
alter table public.webhook_settings add column if not exists trigger_expiry_digest boolean default true;
