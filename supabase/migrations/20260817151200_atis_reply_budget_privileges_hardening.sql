revoke all on function public.atis_check_reply_budget(uuid,text,integer,integer,timestamptz) from public;
revoke all on function public.atis_check_reply_budget(uuid,text,integer,integer,timestamptz) from anon;
revoke all on function public.atis_check_reply_budget(uuid,text,integer,integer,timestamptz) from authenticated;
grant execute on function public.atis_check_reply_budget(uuid,text,integer,integer,timestamptz) to service_role;
