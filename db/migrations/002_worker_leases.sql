-- Worker leases and retry controls for render jobs.

alter table render_jobs add column if not exists attempt_count integer not null default 0;
alter table render_jobs add column if not exists max_attempts integer not null default 3;
alter table render_jobs add column if not exists lease_until timestamptz;
alter table render_jobs add column if not exists worker_id text;

alter table render_jobs drop constraint if exists render_jobs_attempt_count_check;
alter table render_jobs add constraint render_jobs_attempt_count_check check (attempt_count >= 0);
alter table render_jobs drop constraint if exists render_jobs_max_attempts_check;
alter table render_jobs add constraint render_jobs_max_attempts_check check (max_attempts between 1 and 10);

create index if not exists idx_render_jobs_claimable on render_jobs(status, lease_until, created_at);
