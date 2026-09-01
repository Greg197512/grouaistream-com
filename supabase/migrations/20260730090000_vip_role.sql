-- VIP: dostęp do odbioru kodów nie zależy od planu Paddle (Pro/Ultimate),
-- tylko od decyzji admina — kto ma rolę 'vip', ten może odbierać kody.
-- (osobna migracja — ADD VALUE do enuma nie może być użyte w tej samej
-- transakcji co jego odczyt/zapis, więc user_roles.role='vip' pojawi się
-- dopiero w kolejnych migracjach/kodzie).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vip';
