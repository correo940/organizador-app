alter table documents
  add column if not exists tags text[] not null default '{}',
  add column if not exists notes text,
  add column if not exists issuer text,
  add column if not exists summary text,
  add column if not exists document_type text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update documents
set
  tags = coalesce(tags, '{}'),
  metadata = coalesce(metadata, '{}'::jsonb)
where tags is null or metadata is null;
