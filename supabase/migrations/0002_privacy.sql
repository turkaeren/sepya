-- 30 günden eski IP adreslerinin son hanesini (IPv4 /24, IPv6 /48) siler.
-- Yönetim paneli her açıldığında çağrılır; pg_cron gerekmez.
create or replace function public.anonymize_old_ips() returns void
language sql security invoker set search_path = '' as $$
  update public.reader_sessions
     set ip = network(set_masklen(ip, case when family(ip) = 4 then 24 else 48 end))::inet
   where created_at < now() - interval '30 days'
     and ip is not null and masklen(ip) = case when family(ip) = 4 then 32 else 128 end;
  update public.pin_attempts
     set ip = network(set_masklen(ip, case when family(ip) = 4 then 24 else 48 end))::inet
   where attempted_at < now() - interval '30 days'
     and ip is not null and masklen(ip) = case when family(ip) = 4 then 32 else 128 end;
  update public.admin_login_events
     set ip = network(set_masklen(ip, case when family(ip) = 4 then 24 else 48 end))::inet
   where at < now() - interval '30 days'
     and ip is not null and masklen(ip) = case when family(ip) = 4 then 32 else 128 end;
  delete from public.ip_blocks where until < now() - interval '1 day';
$$;

revoke execute on function public.anonymize_old_ips() from anon, authenticated, public;
grant execute on function public.anonymize_old_ips() to service_role;
