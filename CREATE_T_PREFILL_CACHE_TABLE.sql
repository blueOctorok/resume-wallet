-- Create T Backend Prefill Cache Table
-- This table stores AI extraction results separately from resumes
-- Cache persists even if resumes are deleted (useful for testing/admin resets)

create table if not exists public.t_prefill_cache (
  -- Primary cache key (T Backend's file_id for guaranteed uniqueness)
  cache_key text primary key,
  
  -- Extracted form data (form1Data, form2Data, form3Data, stats, metadata)
  payload jsonb not null,
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Reference fields for lookups (both indexed for fast queries)
  ipfs_hash text not null,    -- IPFS CID of the resume
  file_id text not null,       -- T Backend's file_id
  file_hash text,              -- SHA-256 hash of original file content
  
  -- User reference (optional, for potential cleanup)
  user_id uuid
);

-- Indexes for fast lookups
create index if not exists idx_t_prefill_cache_ipfs_hash 
  on public.t_prefill_cache(ipfs_hash);

create index if not exists idx_t_prefill_cache_file_id 
  on public.t_prefill_cache(file_id);

create index if not exists idx_t_prefill_cache_file_hash 
  on public.t_prefill_cache(file_hash);

create index if not exists idx_t_prefill_cache_user_id 
  on public.t_prefill_cache(user_id);

-- Updated timestamp trigger
create or replace function update_t_prefill_cache_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_t_prefill_cache_updated_at
  before update on public.t_prefill_cache
  for each row
  execute function update_t_prefill_cache_updated_at();

-- Comments for documentation
comment on table public.t_prefill_cache is 
  'Persistent cache for T Backend AI prefill results. Survives resume deletions.';

comment on column public.t_prefill_cache.cache_key is 
  'Primary key: T Backend file_id (unique per file content)';

comment on column public.t_prefill_cache.payload is 
  'Extracted data: {form1Data, form2Data, form3Data, stats, metadata}';

comment on column public.t_prefill_cache.ipfs_hash is 
  'IPFS CID for resume file (multiple uploads of same file = same hash)';

comment on column public.t_prefill_cache.file_id is 
  'T Backend internal file ID (matches cache_key)';

