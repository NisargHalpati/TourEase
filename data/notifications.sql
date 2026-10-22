-- In-app notifications for user posts. Run once in the Supabase SQL Editor.
-- This migration adds its own table and triggers; it does not alter the existing
-- posts, post_likes, comments, or profiles tables.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_display_name text not null default 'A traveler',
  actor_avatar_url text,
  post_id uuid references public.posts(id) on delete set null,
  notification_type text not null check (notification_type in ('like', 'comment')),
  comment_id text,
  comment_preview text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_no_self_activity
    check (actor_user_id is null or actor_user_id <> recipient_user_id)
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, created_at desc)
  where read_at is null;
create unique index if not exists notifications_unique_like_idx
  on public.notifications (recipient_user_id, actor_user_id, post_id)
  where notification_type = 'like' and actor_user_id is not null and post_id is not null;

alter table public.notifications enable row level security;

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using (recipient_user_id = (select auth.uid()));

drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.create_post_activity_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_payload jsonb := to_jsonb(new);
  v_notification_type text := tg_argv[0];
  v_post_id_text text := nullif(v_payload ->> 'post_id', '');
  v_actor_text text := coalesce(
    nullif(v_payload ->> 'user_id', ''),
    nullif(v_payload ->> 'actor_id', ''),
    nullif(v_payload ->> 'author_id', '')
  );
  v_actor_id uuid;
  v_recipient_id uuid;
  v_actor_name text;
  v_actor_avatar text;
  v_comment_id text;
  v_comment_preview text;
begin
  if v_notification_type is null
     or v_notification_type not in ('like', 'comment')
     or v_post_id_text is null or v_actor_text is null then
    return new;
  end if;

  v_actor_id := v_actor_text::uuid;
  -- Only create activity for the authenticated user represented by the row.
  if auth.uid() is null or v_actor_id is distinct from auth.uid() then
    return new;
  end if;

  select p.user_id
    into v_recipient_id
    from public.posts as p
   where p.id::text = v_post_id_text
     and p.user_id is not null
     and coalesce(p.is_starter, false) is false;

  if v_recipient_id is null or v_recipient_id = v_actor_id then
    return new;
  end if;

  select coalesce(nullif(pr.display_name, ''), 'A traveler'), pr.avatar_url
    into v_actor_name, v_actor_avatar
    from public.profiles as pr
   where pr.id = v_actor_id;
  v_actor_name := coalesce(v_actor_name, 'A traveler');
  if position('@' in v_actor_name) > 0 then
    v_actor_name := 'A traveler';
  end if;

  if v_notification_type = 'comment' then
    v_comment_id := nullif(v_payload ->> 'id', '');
    v_comment_preview := left(btrim(coalesce(
      v_payload ->> 'content',
      v_payload ->> 'body',
      v_payload ->> 'comment',
      v_payload ->> 'text',
      ''
    )), 180);
  end if;

  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    actor_display_name,
    actor_avatar_url,
    post_id,
    notification_type,
    comment_id,
    comment_preview
  ) values (
    v_recipient_id,
    v_actor_id,
    v_actor_name,
    v_actor_avatar,
    v_post_id_text::uuid,
    v_notification_type,
    v_comment_id,
    v_comment_preview
  )
  on conflict do nothing;

  return new;
end;
$function$;

revoke all on function public.create_post_activity_notification() from public, anon, authenticated;

drop trigger if exists notify_post_like on public.post_likes;
create trigger notify_post_like
  after insert on public.post_likes
  for each row execute function public.create_post_activity_notification('like');

drop trigger if exists notify_post_comment on public.comments;
create trigger notify_post_comment
  after insert on public.comments
  for each row execute function public.create_post_activity_notification('comment');
