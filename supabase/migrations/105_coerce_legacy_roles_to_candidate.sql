-- Legacy users.role values `driver` / `developer` (and null) no longer have a
-- mounted shell. CandidateShell is the only non-employer candidate surface.
-- Coerce leftovers so nobody lands on frozen UI if a mount is reintroduced.

UPDATE public.users
SET role = 'candidate'
WHERE role IS NULL
   OR role IN ('driver', 'developer');
