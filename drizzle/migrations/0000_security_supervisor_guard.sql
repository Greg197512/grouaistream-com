alter table public.automation_control add column if not exists last_run_at timestamptz;
create or replace function public.automation_allowed(_job text) returns boolean
language plpgsql security definer set search_path=public as $f$
declare g boolean; r public.automation_control;
begin
  -- security agent is the supervisor: always runs, cannot be switched off
  if _job = 'agent-security-scan' then
    update automation_control set last_run_at=now(), runs_today=runs_today+1 where job_name=_job;
    return true;
  end if;
  select enabled into g from automation_control where job_name='__GLOBAL__';
  if coalesce(g,true) = false then return false; end if;
  insert into automation_control(job_name) values (_job) on conflict do nothing;
  update automation_control set runs_today = case when day<>current_date then 0 else runs_today end,
         day=current_date where job_name=_job returning * into r;
  -- block if disabled, over cap, or a duplicate run within 60s
  if not r.enabled or r.runs_today >= r.daily_cap
     or (r.last_run_at is not null and r.last_run_at > now() - interval '60 seconds') then
    update automation_control set last_blocked_at=now() where job_name=_job; return false;
  end if;
  update automation_control set runs_today=runs_today+1, last_run_at=now(), updated_at=now() where job_name=_job;
  return true;
end $f$;
revoke execute on function public.automation_allowed(text) from public, anon, authenticated;