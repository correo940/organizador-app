alter table documents
  add column if not exists lifecycle_status text not null default 'activo',
  add column if not exists renewal_of uuid references documents(id) on delete set null;

create index if not exists idx_documents_lifecycle_status on documents(lifecycle_status);
create index if not exists idx_documents_renewal_of on documents(renewal_of);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_lifecycle_status_check'
  ) then
    alter table documents
      add constraint documents_lifecycle_status_check
      check (lifecycle_status in ('activo', 'pendiente_revision', 'pendiente_renovacion', 'archivado'));
  end if;
end $$;

create table if not exists document_reminders (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'custom',
  offset_days integer,
  interval_months integer,
  next_date date not null,
  channel text not null default 'in_app',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_document_reminders_document_id on document_reminders(document_id);
create index if not exists idx_document_reminders_next_date on document_reminders(next_date);
create index if not exists idx_document_reminders_active on document_reminders(is_active);

alter table document_reminders enable row level security;

drop policy if exists "Users can view reminders for their documents" on document_reminders;
create policy "Users can view reminders for their documents"
  on document_reminders for select
  using (
    exists (
      select 1
      from documents
      where documents.id = document_reminders.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert reminders for their documents" on document_reminders;
create policy "Users can insert reminders for their documents"
  on document_reminders for insert
  with check (
    exists (
      select 1
      from documents
      where documents.id = document_reminders.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update reminders for their documents" on document_reminders;
create policy "Users can update reminders for their documents"
  on document_reminders for update
  using (
    exists (
      select 1
      from documents
      where documents.id = document_reminders.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete reminders for their documents" on document_reminders;
create policy "Users can delete reminders for their documents"
  on document_reminders for delete
  using (
    exists (
      select 1
      from documents
      where documents.id = document_reminders.document_id
        and documents.user_id = auth.uid()
    )
  );

drop trigger if exists update_document_reminders_updated_at on document_reminders;
create trigger update_document_reminders_updated_at
  before update on document_reminders
  for each row
  execute function update_updated_at_column();

create table if not exists document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  version_number integer not null,
  title text not null,
  category text not null,
  file_url text not null,
  file_type text,
  expiration_date date,
  is_favorite boolean,
  tags text[] not null default '{}',
  notes text,
  issuer text,
  summary text,
  document_type text,
  metadata jsonb not null default '{}'::jsonb,
  lifecycle_status text not null default 'activo',
  renewal_of uuid references documents(id) on delete set null,
  changed_by uuid references auth.users(id),
  change_description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_versions_document_id on document_versions(document_id);
create index if not exists idx_document_versions_created_at on document_versions(created_at);

alter table document_versions enable row level security;

drop policy if exists "Users can view versions for their documents" on document_versions;
create policy "Users can view versions for their documents"
  on document_versions for select
  using (
    exists (
      select 1
      from documents
      where documents.id = document_versions.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert versions for their documents" on document_versions;
create policy "Users can insert versions for their documents"
  on document_versions for insert
  with check (
    exists (
      select 1
      from documents
      where documents.id = document_versions.document_id
        and documents.user_id = auth.uid()
    )
  );

create or replace function create_document_version()
returns trigger as $$
begin
  if (
    old.title is distinct from new.title or
    old.category is distinct from new.category or
    old.file_url is distinct from new.file_url or
    old.file_type is distinct from new.file_type or
    old.expiration_date is distinct from new.expiration_date or
    old.is_favorite is distinct from new.is_favorite or
    old.tags is distinct from new.tags or
    old.notes is distinct from new.notes or
    old.issuer is distinct from new.issuer or
    old.summary is distinct from new.summary or
    old.document_type is distinct from new.document_type or
    old.metadata is distinct from new.metadata or
    old.lifecycle_status is distinct from new.lifecycle_status or
    old.renewal_of is distinct from new.renewal_of
  ) then
    insert into document_versions (
      document_id,
      version_number,
      title,
      category,
      file_url,
      file_type,
      expiration_date,
      is_favorite,
      tags,
      notes,
      issuer,
      summary,
      document_type,
      metadata,
      lifecycle_status,
      renewal_of,
      changed_by
    )
    values (
      old.id,
      coalesce((select max(version_number) + 1 from document_versions where document_id = old.id), 1),
      old.title,
      old.category,
      old.file_url,
      old.file_type,
      old.expiration_date,
      old.is_favorite,
      coalesce(old.tags, '{}'),
      old.notes,
      old.issuer,
      old.summary,
      old.document_type,
      coalesce(old.metadata, '{}'::jsonb),
      coalesce(old.lifecycle_status, 'activo'),
      old.renewal_of,
      auth.uid()
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists document_version_on_update on documents;
create trigger document_version_on_update
  before update on documents
  for each row
  execute function create_document_version();

