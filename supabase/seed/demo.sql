-- Deterministic synthetic records, anchored to today's Malaysian date.
-- Run AFTER migrations, BEFORE account provisioning. Safe to re-run; does not overwrite edited permissions.
insert into public.residential_blocks(id,kk_name,block_name,capacity)
select ('00000000-0000-4000-8000-'||lpad((1001+i)::text,12,'0'))::uuid,case when i<3 then 'KK3' else 'KK8' end,(array['A','B','C'])[i%3+1],40 from generate_series(0,5) i on conflict do nothing;
insert into public.students(id,student_id,name,year_of_study,faculty)
select ('00000000-0000-4000-8000-'||lpad((i+1)::text,12,'0'))::uuid,'DEMO'||lpad((i+1)::text,3,'0'),
 case when i<4 then (array['Alex Tan','Sarah Lim','Daniel Wong','Emily Lee'])[i+1] else (array['Aiman','Mei','Farah','Arun','Hana','Ravi','Nadia','Jun','Irfan','Sofia','Kai','Aisha'])[i%12+1]||' '||(array['Rahman','Chen','Kumar','Aziz','Tan','Lim','Wong','Lee','Hassan','Devi','Ng','Omar','Yap','Ismail','Low','Teoh','Chong'])[(i/12)%17+1]||' '||lpad((i+1)::text,3,'0') end,
 case when i<4 then (array[1,2,1,3])[i+1] else i%4+1 end,(array['Engineering','Science','Arts & Social Sciences','Business & Economics'])[i%4+1]
 from generate_series(0,199) i on conflict do nothing;
insert into public.residencies(student_id,block_id,room_number,start_date,end_date,status)
select ('00000000-0000-4000-8000-'||lpad((i+1)::text,12,'0'))::uuid,
 ('00000000-0000-4000-8000-'||lpad((1001+case when i in (0,3) then 0 when i=1 then 1 else i%6 end)::text,12,'0'))::uuid,
 case when i=0 then 'A-201' when i=1 then 'B-105' else (array['A','B','C'])[(case when i=3 then 0 else i%6 end)%3+1]||'-'||(101+i)::text end,
 (now() at time zone 'Asia/Kuala_Lumpur')::date-180,
 (now() at time zone 'Asia/Kuala_Lumpur')::date+case when i=3 or i>3 and i%19=0 then -1 else 180 end,
 case when i=3 or i>3 and i%19=0 then 'expired' else 'active' end from generate_series(0,199) i where i<>2 on conflict(student_id) do nothing;
insert into public.access_events(id,student_id,block_id,timestamp,granted,denial_reason,verification_method)
select ('00000000-0000-4000-8000-'||lpad((10000+d*200+i)::text,12,'0'))::uuid,s.id,r.block_id,t.ts,r.status='active' and (i+d)%17<>0,
 case when r.status<>'active' then 'Residential permission expired' when (i+d)%17=0 then 'No active block permission' else null end,'demo_seed'
from generate_series(0,59) d cross join generate_series(0,199) i
join public.students s on s.id=('00000000-0000-4000-8000-'||lpad((i+1)::text,12,'0'))::uuid join public.residencies r on r.student_id=s.id
cross join lateral (select (((now() at time zone 'Asia/Kuala_Lumpur')::date-d)::timestamp+make_interval(hours=>8+(i*7+d)%15,mins=>(i*11+d)%60)) at time zone 'Asia/Kuala_Lumpur' as ts) t
where (i*13+d*7)%31<=(i%5)*5+2 and t.ts<=now() on conflict do nothing;
insert into public.holiday_declarations(student_id,holiday_name,period_id,start_date,end_date,staying,response)
select s.id,p.name,p.id,p.start_date,p.end_date,true,'entire' from public.students s join public.residencies r on r.student_id=s.id cross join public.holiday_periods p
where p.name='Semester break' and r.status='active' and (((right(s.student_id,3)::int-1)*7+(right(s.student_id,3)::int-1)/6)%10)<2+(right(s.student_id,3)::int-1)%6 on conflict do nothing;
insert into public.security_alerts(id,block_id,timestamp,alert_type,status,description) values
('00000000-0000-4000-8000-000000900001','00000000-0000-4000-8000-000000001002',now()-interval '2 hours','five_failures','new','Demo Data: five denied attempts; human review required.'),
('00000000-0000-4000-8000-000000900002','00000000-0000-4000-8000-000000001001',now()-interval '1 day','five_failures','resolved','Demo Data: event reviewed by residential security.') on conflict do nothing;
