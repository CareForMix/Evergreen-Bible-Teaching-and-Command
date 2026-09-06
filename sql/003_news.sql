create table if not exists news (
  id bigserial primary key,
  title varchar(240) not null,
  summary text not null default '',
  body text not null default '',
  image_url text,
  link_url text,
  active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_news_active_published
  on news(active, published_at desc);