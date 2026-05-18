-- 1. Delete duplicates, keeping the oldest one
DELETE FROM expense_categories
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
         ROW_NUMBER() OVER (partition BY name ORDER BY created_at ASC) as r
    FROM expense_categories
  ) t
  WHERE t.r > 1
);

-- 2. Add Unique Constraint to prevent future duplicates
ALTER TABLE expense_categories ADD CONSTRAINT expense_categories_name_key UNIQUE (name);
