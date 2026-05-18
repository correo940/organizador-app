alter table documents
  add column if not exists tags text[] not null default '{}',
  add column if not exists notes text;

update documents
set tags = '{}'
where tags is null;
