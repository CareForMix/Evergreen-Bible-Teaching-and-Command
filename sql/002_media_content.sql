alter table events
  add column if not exists image_url text;

create table if not exists announcements (
  id bigserial primary key,
  title varchar(240) not null,
  body text not null default '',
  link_url text,
  active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists gallery (
  id bigserial primary key,
  title varchar(240) not null,
  caption text not null default '',
  image_url text not null,
  category varchar(120) not null default 'Ministry',
  active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_announcements_active_published
  on announcements(active, published_at desc);

create index if not exists idx_gallery_active_published
  on gallery(active, published_at desc);