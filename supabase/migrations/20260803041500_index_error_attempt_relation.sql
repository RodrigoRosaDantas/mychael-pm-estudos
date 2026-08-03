begin;

create index if not exists error_items_attempt_id_idx
on public.error_items (attempt_id)
where attempt_id is not null;

commit;
