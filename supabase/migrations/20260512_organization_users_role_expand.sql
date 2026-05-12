-- Allinea il CHECK ruoli a schema.sql: admin, pro, member, viewer.
-- Prima del deploy molti DB avevano solo admin + viewer; member/pro fallivano in insert.

alter table public.organization_users
  drop constraint if exists organization_users_role_check;

alter table public.organization_users
  add constraint organization_users_role_check
  check (role in ('admin', 'pro', 'member', 'viewer'));
