-- AEM Video Factory production provenance schema.
-- Apply with a migration tool (Prisma, Flyway, Liquibase, or psql in CI).
-- The application must keep the API state-transition rules in sync with these checks.

create extension if not exists pgcrypto;

create or replace function valid_provenance_formats(formats text[])
returns boolean
language plpgsql
immutable
as $$
declare
  format_name text;
  seen_formats text[] := '{}';
begin
  if formats is null or cardinality(formats) < 1 or cardinality(formats) > 4 then
    return false;
  end if;
  foreach format_name in array formats loop
    if format_name not in ('16x9', '9x16', '1x1', '4K') or format_name = any(seen_formats) then
      return false;
    end if;
    seen_formats := array_append(seen_formats, format_name);
  end loop;
  return true;
end;
$$;

create table if not exists campaign_revisions (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  content_fragment_path text not null,
  content_revision text,
  content_hash char(64) not null,
  source text not null check (source in ('aem', 'mock')),
  content_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, content_hash)
);

create table if not exists render_jobs (
  render_id text primary key,
  campaign_revision_id uuid not null references campaign_revisions(id),
  template_id text not null,
  template_version text not null,
  design_system_version text not null,
  rendering_engine text not null check (rendering_engine in ('remotion', 'videoflow')),
  output_formats text[] not null check (valid_provenance_formats(output_formats)),
  status text not null default 'queued' check (status in ('queued', 'rendering', 'completed', 'failed')),
  requested_by text not null,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists render_outputs (
  id uuid primary key default gen_random_uuid(),
  render_id text not null references render_jobs(render_id) on delete cascade,
  output_format text not null check (output_format in ('16x9', '9x16', '1x1', '4K')),
  asset_url text not null,
  checksum text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  created_at timestamptz not null default now(),
  unique (render_id, output_format)
);

create table if not exists campaign_review_events (
  id uuid primary key default gen_random_uuid(),
  campaign_revision_id uuid not null references campaign_revisions(id),
  state text not null check (state in ('draft', 'in-review', 'approved', 'rejected')),
  actor_id text not null,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists render_job_events (
  id bigserial primary key,
  render_id text not null references render_jobs(render_id) on delete cascade,
  from_status text,
  to_status text not null check (to_status in ('queued', 'rendering', 'completed', 'failed')),
  actor_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_campaign_revisions_campaign on campaign_revisions(campaign_id, created_at desc);
create index if not exists idx_render_jobs_status on render_jobs(status, created_at);
create index if not exists idx_render_jobs_requested_by on render_jobs(requested_by, created_at desc);
create index if not exists idx_render_events_render on render_job_events(render_id, created_at);

create or replace function set_render_job_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists render_jobs_updated_at on render_jobs;
create trigger render_jobs_updated_at
before update on render_jobs
for each row execute function set_render_job_updated_at();

create or replace function prevent_terminal_render_mutation()
returns trigger language plpgsql as $$
begin
  if old.status in ('completed', 'failed') and (
    new.status <> old.status or
    new.failure_reason is distinct from old.failure_reason or
    new.completed_at is distinct from old.completed_at
  ) then
    raise exception 'Terminal render jobs are immutable: %', old.render_id;
  end if;
  return new;
end;
$$;

drop trigger if exists render_jobs_terminal_guard on render_jobs;
create trigger render_jobs_terminal_guard
before update on render_jobs
for each row execute function prevent_terminal_render_mutation();

revoke update, delete on render_job_events from public;
revoke update, delete on campaign_review_events from public;
