-- Run the COMPLETE file in one session (SQL Editor or MCP execute_sql).
-- Fixtures are rollback-only; never register simulated activity in the app.
begin;
select set_config('walkworld.test_a', gen_random_uuid()::text, true);
select set_config('walkworld.test_b', gen_random_uuid()::text, true);
insert into auth.users(id) values (current_setting('walkworld.test_a')::uuid), (current_setting('walkworld.test_b')::uuid);
insert into public.profiles(user_id) values (current_setting('walkworld.test_b')::uuid);
insert into public.preferences(user_id) values (current_setting('walkworld.test_b')::uuid);
insert into public.devices(user_id, device_id) select id, id from auth.users where id in (current_setting('walkworld.test_a')::uuid, current_setting('walkworld.test_b')::uuid);
insert into public.daily_steps(user_id,device_id,local_date,timezone,source,steps,goal,partial,revision)
select user_id,device_id,current_date,'America/Santiago','sensor',0,5000,true,1 from public.devices where user_id in (current_setting('walkworld.test_a')::uuid, current_setting('walkworld.test_b')::uuid);
insert into public.step_submissions(user_id,device_id,client_event_id,local_date,timezone,source,steps,partial,revision)
select user_id,device_id,gen_random_uuid(),current_date,'America/Santiago','sensor',0,true,1 from public.devices where user_id in (current_setting('walkworld.test_a')::uuid, current_setting('walkworld.test_b')::uuid);
insert into public.coin_ledger(user_id,idempotency_key,delta,reason)
select user_id,'rollback-only-fixture',1,'test' from public.devices where user_id in (current_setting('walkworld.test_a')::uuid, current_setting('walkworld.test_b')::uuid);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('walkworld.test_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('walkworld.test_a'), 'role', 'authenticated')::text, true);
insert into public.preferences(user_id) values (current_setting('walkworld.test_a')::uuid);
-- Own profile insert, update and read must work.
insert into public.profiles(user_id) values (current_setting('walkworld.test_a')::uuid);
do $$
declare tbl text; n bigint; op text;
begin
  foreach tbl in array array['profiles','preferences','devices','step_submissions','daily_steps','coin_ledger'] loop
    execute format('select count(*) from public.%I', tbl) into n;
    if n <> 1 then raise exception 'Own-only SELECT failed: % (% rows)', tbl, n; end if;
    execute format('select count(*) from public.%I where user_id = $1', tbl) into n using current_setting('walkworld.test_b')::uuid;
    if n <> 0 then raise exception 'Cross-account leak: %', tbl; end if;
    if has_table_privilege('authenticated','public.' || tbl,'DELETE') then raise exception 'Unexpected DELETE grant: %', tbl; end if;
  end loop;
  foreach tbl in array array['devices','step_submissions','daily_steps','coin_ledger'] loop
    foreach op in array array['INSERT','UPDATE','DELETE'] loop
      if has_table_privilege('authenticated','public.' || tbl,op) then raise exception 'Client mutation allowed: % %', tbl, op; end if;
    end loop;
  end loop;
  update public.profiles set display_name = 'Own profile' where user_id = current_setting('walkworld.test_a')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Own UPDATE failed'; end if;
  update public.profiles set display_name = 'Forbidden' where user_id = current_setting('walkworld.test_b')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Cross-account UPDATE succeeded'; end if;
  begin
    update public.profiles set user_id = current_setting('walkworld.test_b')::uuid;
    raise exception 'Owner reassignment succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.profiles(user_id) values(current_setting('walkworld.test_b')::uuid);
    raise exception 'Cross-account INSERT succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.preferences set daily_goal = 1;
    raise exception 'Invalid goal accepted';
  exception when check_violation then null; end;
  begin
    insert into public.coin_ledger(user_id,idempotency_key,delta,reason) values(current_setting('walkworld.test_a')::uuid,'forged',200,'forged');
    raise exception 'Client forged coins';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.profiles;
    raise exception 'Client deleted profiles';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Verify duplicate reward events are rejected even for the server role.
do $$
begin
  begin
    insert into public.coin_ledger(user_id,idempotency_key,delta,reason)
    values(current_setting('walkworld.test_a')::uuid,'rollback-only-fixture',1,'test');
    raise exception 'Duplicate ledger event accepted';
  exception when unique_violation then null; end;
end $$;
set local role anon;
do $$
declare tbl text; op text;
begin
  foreach tbl in array array['profiles','preferences','devices','step_submissions','daily_steps','coin_ledger'] loop
    foreach op in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if has_table_privilege('anon','public.' || tbl,op) then raise exception 'Guest grant found: % %', tbl, op; end if;
    end loop;
    begin
      execute format('select * from public.%I', tbl);
      raise exception 'Guest read succeeded: %', tbl;
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
reset role;
select 'PASS: ownership, guest denial, write denial, goal validation, reward idempotency' as result;
rollback;
