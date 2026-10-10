-- All fixtures are rolled back. Run against the isolated WalkWorld project.
begin;
insert into auth.users(id) values('f1bbae71-9a02-4b87-8337-c64e8d322001'),('f1bbae71-9a02-4b87-8337-c64e8d322002');
set local role service_role;
do $$
declare a jsonb; b jsonb; p jsonb:='{"name":"Test temporal","avatar":"walker","goal":5000,"strideMeters":0.7,"weightKg":70,"theme":"system"}';
  d jsonb:='[{"date":"2026-10-08","steps":5000,"goal":5000,"source":"sensor","partial":true,"timezone":"America/Santiago","revision":1,"anomalies":0}]';
  u uuid:='f1bbae71-9a02-4b87-8337-c64e8d322001'; v uuid:='f1bbae71-9a02-4b87-8337-c64e8d322002';
  phone uuid:='9515d1be-bf4a-4d2d-bc17-6bfa02598201'; other uuid:='9515d1be-bf4a-4d2d-bc17-6bfa02598202';
begin
  a:=public.sync_walkworld(u,phone,d,array['1:1'],p,true);
  if (a->>'balance')::int<>85 then raise exception 'Incorrect reward balance';end if;
  b:=public.sync_walkworld(u,phone,d,array['1:1'],p,true);
  if (b->>'balance')::int<>85 or (select count(*) from public.step_submissions where user_id=u)<>1 then raise exception 'Replay duplicated data';end if;
  b:=public.sync_walkworld(u,other,jsonb_set(d,'{0,steps}','10000'),array[]::text[],p,false);
  if (b->>'balance')::int<>85 or (b->'days'->0->>'steps')::int<>5000 then raise exception 'Second device duplicated walking';end if;
  b:=public.sync_walkworld(v,other,'[]',array['2:2'],p,false);
  if jsonb_array_length(b->'cells')<>0 then raise exception 'Sector without steps was accepted';end if;
  if (b->>'balance')::int<>0 then raise exception 'Account data leaked';end if;
  b:=public.sync_walkworld(u,phone,jsonb_set(jsonb_set(jsonb_set(d,'{0,source}','"health-connect"'),'{0,revision}','2'),'{0,steps}','4000'),array[]::text[],p,false);
  if (b->>'balance')::int<>10 then raise exception 'HC incorrectly earned rewards';end if;
  begin
    perform public.sync_walkworld(u,phone,jsonb_set(d,'{0,revision}','3'),array[]::text[],p,false);
    raise exception 'Expected source-reconciliation rejection';
  exception when raise_exception then if sqlerrm='Expected source-reconciliation rejection' then raise;end if;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','f1bbae71-9a02-4b87-8337-c64e8d322002',true);
do $$ begin
 if (select count(*) from public.daily_steps)<>0 or (select count(*) from public.coin_ledger)<>0 or (select count(*) from public.explored_cells)<>0 then raise exception 'RLS leaked another account';end if;
 begin
  perform public.sync_walkworld('f1bbae71-9a02-4b87-8337-c64e8d322002','9515d1be-bf4a-4d2d-bc17-6bfa02598202','[]',array[]::text[],'{}',false);
  raise exception 'Client can invoke server RPC';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
delete from auth.users where id='f1bbae71-9a02-4b87-8337-c64e8d322001';
do $$ begin
 if exists(select 1 from public.profiles where user_id='f1bbae71-9a02-4b87-8337-c64e8d322001')
 or exists(select 1 from public.preferences where user_id='f1bbae71-9a02-4b87-8337-c64e8d322001')
 or exists(select 1 from public.devices where user_id='f1bbae71-9a02-4b87-8337-c64e8d322001')
 or exists(select 1 from public.step_submissions where user_id='f1bbae71-9a02-4b87-8337-c64e8d322001')
 or exists(select 1 from public.daily_steps where user_id='f1bbae71-9a02-4b87-8337-c64e8d322001')
 or exists(select 1 from public.coin_ledger where user_id='f1bbae71-9a02-4b87-8337-c64e8d322001')
 or exists(select 1 from public.explored_cells where user_id='f1bbae71-9a02-4b87-8337-c64e8d322001')
 or exists(select 1 from public.reward_state where user_id='f1bbae71-9a02-4b87-8337-c64e8d322001') then raise exception 'Account deletion left private rows';end if;
 if not exists(select 1 from public.profiles where user_id='f1bbae71-9a02-4b87-8337-c64e8d322002') then raise exception 'Deletion affected another account';end if;
end $$;
rollback;
