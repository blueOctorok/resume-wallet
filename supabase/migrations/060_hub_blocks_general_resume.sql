-- Replace legacy general-skills + general-work-history hub rows with general-resume.
-- general-resume is the universal Indeed-style resume block; the old tiles had no page route.

INSERT INTO hub_blocks (user_id, block_type, position, config)
SELECT u.user_id, 'general-resume', u.min_pos, '{}'::jsonb
FROM (
  SELECT user_id, MIN(position) AS min_pos
  FROM hub_blocks
  WHERE block_type IN ('general-skills', 'general-work-history')
  GROUP BY user_id
) u
WHERE NOT EXISTS (
  SELECT 1 FROM hub_blocks h WHERE h.user_id = u.user_id AND h.block_type = 'general-resume'
);

DELETE FROM hub_blocks
WHERE block_type IN ('general-skills', 'general-work-history');
