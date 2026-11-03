create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  is_premium boolean default false,
  premium_until timestamptz,
  created_at timestamptz default now()
);

create table questions (
  id serial primary key,
  path text not null,            -- 'CSP' | 'CR' | 'NAT'
  topic text,
  statement text not null,
  difficulty int default 1
);

create table answers (
  id serial primary key,
  question_id int references questions(id),
  text text not null,
  is_correct boolean default false
);

create table attempts (
  id serial primary key,
  user_id uuid references users(id),
  path text,
  score int,
  passed boolean,
  created_at timestamptz default now()
);
