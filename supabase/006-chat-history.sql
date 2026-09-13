-- Persists chat conversations so they survive a refresh and can be revisited
-- later, instead of living only in the browser tab's memory. Safe to re-run.

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.chat_conversations to authenticated;
grant all on public.chat_conversations to service_role;
alter table public.chat_conversations enable row level security;

drop policy if exists chat_conversations_own on public.chat_conversations;
create policy chat_conversations_own on public.chat_conversations for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;

-- A message is only visible/insertable by the owner of its conversation —
-- there's no user_id column on the message itself, so this checks via a join.
drop policy if exists chat_messages_own on public.chat_messages;
create policy chat_messages_own on public.chat_messages for all to authenticated
  using (exists (select 1 from public.chat_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.chat_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- Keep the conversation's updated_at (used for sorting the history list)
-- current whenever a message is added.
create or replace function public.touch_conversation_updated_at() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.chat_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_touch on public.chat_messages;
create trigger chat_messages_touch after insert on public.chat_messages
  for each row execute function public.touch_conversation_updated_at();
