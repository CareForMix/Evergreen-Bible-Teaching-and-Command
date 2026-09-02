create table if not exists teachings (
  id bigserial primary key,
  slug varchar(160) unique not null,
  title varchar(240) not null,
  summary text not null default '',
  scripture varchar(500) not null default '',
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id bigserial primary key,
  title varchar(240) not null,
  description text not null default '',
  starts_at timestamptz not null,
  location varchar(300) not null default 'Online',
  registration_url text,
  created_at timestamptz not null default now()
);

create table if not exists testimonies (
  id bigserial primary key,
  name varchar(160) not null,
  title varchar(240) not null,
  body text not null,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists submissions (
  id bigserial primary key,
  type varchar(30) not null check (type in ('prayer','contact','volunteer')),
  name varchar(120) not null,
  email varchar(180),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_teachings_published on teachings(published, published_at desc);
create index if not exists idx_events_starts on events(starts_at);
create index if not exists idx_submissions_type_created on submissions(type, created_at desc);
