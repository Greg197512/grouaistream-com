ALTER TABLE public.ad_campaigns ALTER COLUMN amount_eur SET DEFAULT 5;
UPDATE public.ad_campaigns SET amount_eur = 5 WHERE payment_status = 'pending' AND amount_eur = 10;