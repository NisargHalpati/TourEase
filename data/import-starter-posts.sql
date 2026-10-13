-- Repeatable starter content import. UUIDs are deterministic for
-- "tourease:starter-post:<source id>" in namespace dcb4b417-3012-4f73-a482-03a07d36e2a1.
-- Run in the Supabase SQL Editor. Intentionally excludes sample likes and comments.
insert into public.posts (
  id,
  user_id,
  author_name,
  location,
  caption,
  image_url,
  created_at,
  is_starter
)
values
  (
    '0b75638f-152f-545c-a561-54121796bbf2',
    null,
    'Aarav',
    'Meghalaya',
    'Spent the morning walking through mist-covered hills. Meghalaya feels unreal after the rain.',
    'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=80',
    '2026-10-01T08:00:00.000Z',
    true
  ),
  (
    '6b3da6db-ebc6-519a-88c8-4efe9a9cba72',
    null,
    'Riya',
    'Kerala',
    'Some journeys are better when you slow down. Kerala was exactly that.',
    'https://upload.wikimedia.org/wikipedia/commons/b/b8/Kumarakom.JPG',
    '2026-10-02T08:15:00.000Z',
    true
  ),
  (
    '28b5e35c-e2ab-51e6-873a-a9e328cddad8',
    null,
    'Dev',
    'Ladakh',
    'The road keeps getting higher, and somehow the views keep getting better.',
    'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80',
    '2026-10-03T07:30:00.000Z',
    true
  ),
  (
    '5c2048ba-659f-57d6-a3eb-35391b03b898',
    null,
    'Sana',
    'Rajasthan',
    'Fort walls, desert light, and warm evenings that just linger in your memory.',
    'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1200&q=80',
    '2026-10-04T10:00:00.000Z',
    true
  ),
  (
    'e9f2d2a8-252b-5b15-be41-1b9637b27e34',
    null,
    'Ishaan',
    'Kashmir',
    'It felt like the valley was glowing from the inside. Worth every climb.',
    'https://upload.wikimedia.org/wikipedia/commons/f/f6/Pahalgam_Valley.jpg',
    '2026-10-05T06:00:00.000Z',
    true
  ),
  (
    'ca01aa66-8160-5f41-9090-941427809cc1',
    null,
    'Neha',
    'Goa',
    'Golden beaches, endless sunsets, and the kind of slow mornings you want to keep forever.',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    '2026-10-05T12:30:00.000Z',
    true
  ),
  (
    '01ad0306-161e-55f3-8cad-8e9dc5c67726',
    null,
    'Harsh',
    'Himachal',
    'A little road trip, a little cold air, and a lot of pin-drop silence.',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    '2026-10-06T09:00:00.000Z',
    true
  )
on conflict (id) do nothing;
