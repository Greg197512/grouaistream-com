WITH ranked AS (
  SELECT id,
         lang,
         ROW_NUMBER() OVER (PARTITION BY lang ORDER BY position ASC, id DESC) AS rn
  FROM public.radio_schedule
  WHERE item_type = 'announcement'
    AND (custom_title LIKE '%Blog:%' OR custom_title LIKE '%Блог:%')
)
DELETE FROM public.radio_schedule
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);