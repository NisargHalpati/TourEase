-- Run manually in the Supabase SQL Editor.
-- Updates only the two listed rows, and only if both are still starter posts.
begin;

do $$
begin
  if (
    select count(*)
    from public.posts
    where id in (
      '6b3da6db-ebc6-519a-88c8-4efe9a9cba72',
      'e9f2d2a8-252b-5b15-be41-1b9637b27e34'
    )
      and is_starter is true
  ) <> 2 then
    raise exception 'Expected both target post UUIDs to exist as starter posts; no image URLs were changed.';
  end if;
end
$$;

update public.posts
set image_url = 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Kumarakom.JPG'
where id = '6b3da6db-ebc6-519a-88c8-4efe9a9cba72'
  and is_starter is true;

update public.posts
set image_url = 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Pahalgam_Valley.jpg'
where id = 'e9f2d2a8-252b-5b15-be41-1b9637b27e34'
  and is_starter is true;

commit;
