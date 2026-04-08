-- Eseguire dopo aver creato manualmente il primo utente in Supabase Auth.
-- Sostituire i placeholder prima dell'esecuzione.

insert into public.organizations (id, name, allowed_ip)
values ('11111111-1111-1111-1111-111111111111', 'Agenzia Demo', '127.0.0.1')   --Sostituisci nome e IP con quello dell azienda
on conflict (id) do nothing;

insert into public.data_retention_policies (
  organization_id,
  dataset_name,
  retention_days,
  legal_basis
)
values
  ('11111111-1111-1111-1111-111111111111', 'access_audit_logs', 365, 'Sicurezza operativa B2B'),
  ('11111111-1111-1111-1111-111111111111', 'compliance_events', 730, 'Obblighi di accountability')
on conflict (organization_id, dataset_name) do update
set
  retention_days = excluded.retention_days,
  legal_basis = excluded.legal_basis,
  updated_at = now();

insert into public.processing_activities (
  organization_id,
  activity_name,
  data_categories,
  purpose,
  legal_basis,
  retention_reference
)
values (
  '11111111-1111-1111-1111-111111111111',
  'Monitoraggio accessi monitor operativi',
  array['dati account', 'log tecnici', 'indirizzi ip'],
  'Sicurezza piattaforma editoriale',
  'Legittimo interesse del titolare in ambito B2B',
  'Policy access_audit_logs'
)
on conflict do nothing;

insert into public.organization_users (organization_id, user_id, role)
values (
  '11111111-1111-1111-1111-111111111111', --Sostituisci con ID dell azienda
  '75dae453-8695-47c7-83e4-721b09de3ce8',
  'admin'
)
on conflict (organization_id, user_id) do nothing;

insert into public.subscriptions (
  id,
  organization_id,
  stripe_customer_id,
  plan,
  status,
  current_period_end
)
values (
  'sub_test_111111111111111111111111',
  '11111111-1111-1111-1111-111111111111',
  'cus_test_111111111111111111111111',
  'b2b-test',
  'active',
  now() + interval '30 days'
)
on conflict (id) do nothing;
