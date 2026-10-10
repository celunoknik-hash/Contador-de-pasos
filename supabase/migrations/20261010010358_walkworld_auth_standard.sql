create or replace function public.sync_walkworld(p_user uuid,p_device uuid,p_days jsonb,p_cells text[],p_preferences jsonb,p_edit_preferences boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d jsonb; old public.daily_steps; date_value date; zone text; steps_value integer; revision_value bigint;
  target record; previous public.reward_state; delta_value integer; next_version bigint; cell text; eligible_total bigint;
begin
  if jsonb_typeof(p_days)<>'array' or jsonb_array_length(p_days)>100 or coalesce(cardinality(p_cells),0)>100 then raise exception 'Batch too large'; end if;
  insert into public.profiles(user_id,display_name,avatar_key) values(p_user,coalesce(p_preferences->>'name','Explorador'),coalesce(p_preferences->>'avatar','walker')) on conflict(user_id) do nothing;
  perform 1 from public.profiles where user_id=p_user for update;
  insert into public.preferences(user_id) values(p_user) on conflict(user_id) do nothing;
  if p_edit_preferences then
    update public.profiles set display_name=p_preferences->>'name',avatar_key=coalesce(p_preferences->>'avatar','walker') where user_id=p_user;
    update public.preferences set daily_goal=(p_preferences->>'goal')::integer,stride_meters=(p_preferences->>'strideMeters')::numeric,weight_kg=(p_preferences->>'weightKg')::numeric,theme=p_preferences->>'theme' where user_id=p_user;
  end if;
  insert into public.devices(user_id,device_id) values(p_user,p_device) on conflict do nothing;
  for d in select value from jsonb_array_elements(p_days) loop
    date_value=(d->>'date')::date; zone=d->>'timezone'; steps_value=(d->>'steps')::integer; revision_value=(d->>'revision')::bigint;
    if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception 'Invalid timezone'; end if;
    if date_value>(now() at time zone zone)::date or date_value<(now() at time zone zone)::date-3650 then raise exception 'Invalid activity date'; end if;
    if d->>'source'='sensor' and steps_value>least(250000,extract(epoch from (now()-(date_value::timestamp at time zone zone)))*4+20) then raise exception 'Implausible daily total'; end if;
    if exists(select 1 from public.step_submissions where user_id=p_user and device_id=p_device and local_date=date_value and revision=revision_value and (steps<>steps_value or source<>d->>'source')) then raise exception 'Conflicting revision'; end if;
    insert into public.step_submissions(user_id,device_id,client_event_id,local_date,timezone,source,steps,revision,partial,anomalies)
      values(p_user,p_device,md5(p_device::text||date_value::text||revision_value::text)::uuid,date_value,zone,d->>'source',steps_value,revision_value,(d->>'partial')::boolean,coalesce((d->>'anomalies')::integer,0)) on conflict(user_id,device_id,local_date,revision) do nothing;
    select * into old from public.daily_steps where user_id=p_user and local_date=date_value;
    if not found then
      insert into public.daily_steps(user_id,local_date,device_id,timezone,source,steps,goal,partial,revision) values(p_user,date_value,p_device,zone,d->>'source',steps_value,(d->>'goal')::integer,(d->>'partial')::boolean,revision_value);
    elsif old.device_id=p_device and old.revision<revision_value then
      -- Sensor totals cannot decrease; HC snapshots can be corrected. Never return from HC to sensor that day.
      if old.source='health-connect' and d->>'source'='sensor' then raise exception 'Source already reconciled'; end if;
      if old.source='sensor' and d->>'source'='sensor' and steps_value<old.steps then raise exception 'Sensor total decreased'; end if;
      update public.daily_steps set steps=steps_value,source=d->>'source',partial=(d->>'partial')::boolean,revision=revision_value,updated_at=now() where user_id=p_user and local_date=date_value;
    end if;
  end loop;
  select coalesce(sum(steps),0) into eligible_total from public.daily_steps where user_id=p_user and source='sensor';
  foreach cell in array coalesce(p_cells,array[]::text[]) loop
    if cell !~ '^-?[0-9]+:-?[0-9]+$' or abs(split_part(cell,':',1)::bigint)>166980 or abs(split_part(cell,':',2)::bigint)>166600 then raise exception 'Invalid geographic cell'; end if;
    if not exists(select 1 from public.explored_cells where user_id=p_user and cell_id=cell) then
      if (select count(*) from public.explored_cells where user_id=p_user)+1>eligible_total/12 then raise exception 'Sector lacks step evidence'; end if;
      insert into public.explored_cells(user_id,cell_id) values(p_user,cell) on conflict do nothing;
    end if;
  end loop;
  for target in
    select q.date_key::text as period, q.name||':'||q.date_key::text as key, q.amount, q.label from (
      select s.local_date as date_key,v.name,v.label,
        case when s.source<>'sensor' then 0 when v.name='steps' then least(s.steps,20000)/100
          when v.name='steps-3000' and s.steps>=3000 then 5 when v.name='steps-5000' and s.steps>=5000 then 10
          when v.name='daily-goal' and s.steps>=s.goal then 10 else 0 end as amount
      from public.daily_steps s cross join (values('steps','Pasos del día'),('steps-3000','Un buen comienzo'),('steps-5000','Sigue explorando'),('daily-goal','A tu propio ritmo')) v(name,label) where s.user_id=p_user
    ) q
    union all select null,'three-days:v1',case when exists(
      select 1 from public.daily_steps a join public.daily_steps b on b.user_id=a.user_id and b.local_date=a.local_date-1 join public.daily_steps c on c.user_id=a.user_id and c.local_date=a.local_date-2
      where a.user_id=p_user and a.source='sensor' and b.source='sensor' and c.source='sensor' and a.steps>=a.goal and b.steps>=b.goal and c.steps>=c.goal
    ) then 25 else 0 end,'Pequeños hábitos'
    union all select null,'explore-first:v1',case when exists(select 1 from public.explored_cells where user_id=p_user) then 10 else 0 end,'Primer sector'
  loop
    select * into previous from public.reward_state where user_id=p_user and reward_key=target.key;
    delta_value=target.amount-coalesce(previous.amount,0);
    if delta_value<>0 then
      next_version=coalesce(previous.version,0)+1;
      insert into public.coin_ledger(user_id,idempotency_key,delta,reason,local_date) values(p_user,target.key||':v'||next_version::text,delta_value,target.label,target.period::date);
      insert into public.reward_state(user_id,reward_key,amount,version) values(p_user,target.key,target.amount,next_version) on conflict(user_id,reward_key) do update set amount=excluded.amount,version=excluded.version;
    end if;
  end loop;
  return jsonb_build_object(
    'days',coalesce((select jsonb_agg(jsonb_build_object('date',local_date,'steps',steps,'goal',goal,'source',source,'partial',partial,'timezone',timezone,'updatedAt',updated_at,'revision',revision,'anomalies',0,'deviceId',device_id) order by local_date desc) from public.daily_steps where user_id=p_user),'[]'::jsonb),
    'cells',coalesce((select jsonb_agg(cell_id) from public.explored_cells where user_id=p_user),'[]'::jsonb),
    'balance',(select coalesce(sum(delta),0) from public.coin_ledger where user_id=p_user),
    'profile',(select to_jsonb(p) from public.profiles p where user_id=p_user),
    'preferences',(select to_jsonb(p) from public.preferences p where user_id=p_user)
  );
end $$;


