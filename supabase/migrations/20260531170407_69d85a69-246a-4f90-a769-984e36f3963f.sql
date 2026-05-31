
-- =========================================================
-- AMPARO — Foundation migration
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- Helper: updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  photo_url text,
  onboarding_step int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create policy "users can read own profile" on public.profiles for select
  using (id = auth.uid());
create policy "users can update own profile" on public.profiles for update
  using (id = auth.uid());
create policy "users can insert own profile" on public.profiles for insert
  with check (id = auth.uid());

-- ---------- FAMILIES ----------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

grant select, insert, update on public.families to authenticated;
grant all on public.families to service_role;

alter table public.families enable row level security;

create trigger families_updated_at before update on public.families
  for each row execute function public.set_updated_at();

-- ---------- FAMILY_MEMBERS ----------
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','editor','viewer','caregiver')),
  status text not null check (status in ('invited','active','removed')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (family_id, user_id)
);

create index idx_family_members_family_id on public.family_members(family_id);
create index idx_family_members_user_id on public.family_members(user_id);

grant select, insert, update, delete on public.family_members to authenticated;
grant all on public.family_members to service_role;

alter table public.family_members enable row level security;

create trigger family_members_updated_at before update on public.family_members
  for each row execute function public.set_updated_at();

-- ---------- Helper functions (after family_members exists) ----------
create or replace function public.is_family_member(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fid
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.has_family_role(fid uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = fid
      and user_id = auth.uid()
      and status = 'active'
      and role = any(roles)
  );
$$;

create or replace function public.get_solo_admin_families(p_user_id uuid)
returns table(family_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select fm.family_id
  from public.family_members fm
  where fm.user_id = p_user_id
    and fm.role = 'admin'
    and fm.status = 'active'
    and fm.family_id in (
      select family_id from public.family_members
      where role = 'admin' and status = 'active'
      group by family_id
      having count(*) = 1
    );
$$;

-- ---------- FAMILIES policies ----------
create policy "members can read families" on public.families for select
  using (public.is_family_member(id));
create policy "admins can update families" on public.families for update
  using (public.has_family_role(id, array['admin']));
create policy "authenticated can insert families" on public.families for insert
  with check (auth.uid() is not null);

-- ---------- FAMILY_MEMBERS policies ----------
create policy "members can read family_members" on public.family_members for select
  using (public.is_family_member(family_id));
create policy "admins can manage family_members" on public.family_members for all
  using (public.has_family_role(family_id, array['admin']));

-- ---------- INVITATIONS ----------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  email text,
  role text not null check (role in ('admin','editor','viewer','caregiver')),
  invited_by uuid references auth.users(id) on delete set null,
  status text not null check (status in ('pending','accepted','expired')),
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index idx_invitations_token on public.invitations(token);

grant select, insert, update on public.invitations to authenticated;
grant all on public.invitations to service_role;

alter table public.invitations enable row level security;

create policy "admins can manage invitations" on public.invitations for all
  using (public.has_family_role(family_id, array['admin']));

-- ---------- PATIENTS ----------
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete restrict,
  name text not null,
  photo_url text,
  birth_date date,
  blood_type text check (blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  height numeric,
  weight numeric,
  health_insurance_name text,
  health_insurance_number text,
  preferred_hospital text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_patients_family_id on public.patients(family_id);
create index idx_patients_deleted_at on public.patients(deleted_at);

grant select, insert, update on public.patients to authenticated;
grant all on public.patients to service_role;

alter table public.patients enable row level security;

create trigger patients_updated_at before update on public.patients
  for each row execute function public.set_updated_at();

create policy "members can read patients" on public.patients for select
  using (public.is_family_member(family_id) and deleted_at is null);
create policy "editors can insert patients" on public.patients for insert
  with check (public.has_family_role(family_id, array['admin','editor']));
create policy "editors can update patients" on public.patients for update
  using (public.has_family_role(family_id, array['admin','editor']) and deleted_at is null);

-- ---------- PATIENT_CONDITIONS ----------
create table public.patient_conditions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  name text not null,
  description text,
  diagnosed_at date,
  status text check (status in ('active','inactive','unknown')),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_patient_conditions_patient_id on public.patient_conditions(patient_id);
create index idx_patient_conditions_deleted_at on public.patient_conditions(deleted_at);

grant select, insert, update on public.patient_conditions to authenticated;
grant all on public.patient_conditions to service_role;

alter table public.patient_conditions enable row level security;

create policy "members can read patient_conditions" on public.patient_conditions for select
  using (
    patient_id in (select p.id from public.patients p where public.is_family_member(p.family_id))
    and deleted_at is null
  );
create policy "editors can insert patient_conditions" on public.patient_conditions for insert
  with check (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
  );
create policy "editors can update patient_conditions" on public.patient_conditions for update
  using (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
    and deleted_at is null
  );

-- ---------- PATIENT_ALLERGIES ----------
create table public.patient_allergies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  allergy text not null,
  severity text check (severity in ('low','medium','high','critical')),
  notes text,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index idx_patient_allergies_patient_id on public.patient_allergies(patient_id);
create index idx_patient_allergies_deleted_at on public.patient_allergies(deleted_at);

grant select, insert, update on public.patient_allergies to authenticated;
grant all on public.patient_allergies to service_role;

alter table public.patient_allergies enable row level security;

create policy "members can read patient_allergies" on public.patient_allergies for select
  using (
    patient_id in (select p.id from public.patients p where public.is_family_member(p.family_id))
    and deleted_at is null
  );
create policy "editors can insert patient_allergies" on public.patient_allergies for insert
  with check (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
  );
create policy "editors can update patient_allergies" on public.patient_allergies for update
  using (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
    and deleted_at is null
  );

-- ---------- EMERGENCY_CONTACTS ----------
create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  name text not null,
  relationship text,
  phone text,
  email text,
  priority int default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index idx_emergency_contacts_patient_id on public.emergency_contacts(patient_id);
create index idx_emergency_contacts_deleted_at on public.emergency_contacts(deleted_at);

grant select, insert, update on public.emergency_contacts to authenticated;
grant all on public.emergency_contacts to service_role;

alter table public.emergency_contacts enable row level security;

create policy "members can read emergency_contacts" on public.emergency_contacts for select
  using (
    patient_id in (select p.id from public.patients p where public.is_family_member(p.family_id))
    and deleted_at is null
  );
create policy "editors can insert emergency_contacts" on public.emergency_contacts for insert
  with check (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
  );
create policy "editors can update emergency_contacts" on public.emergency_contacts for update
  using (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
    and deleted_at is null
  );

-- ---------- MEDICATIONS ----------
-- NOTE: schedule jsonb MUST follow schema { "times": ["08:00","14:00"] } — never any other shape
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  name text not null,
  generic_name text,
  dosage text,
  frequency text,
  schedule jsonb,
  start_date date,
  end_date date,
  prescribed_by text,
  status text not null check (status in ('active','paused','ended')),
  notes text,
  file_path text,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_medications_patient_id on public.medications(patient_id);
create index idx_medications_status on public.medications(status);
create index idx_medications_deleted_at on public.medications(deleted_at);

grant select, insert, update on public.medications to authenticated;
grant all on public.medications to service_role;

alter table public.medications enable row level security;

create trigger medications_updated_at before update on public.medications
  for each row execute function public.set_updated_at();

create policy "members can read medications" on public.medications for select
  using (
    patient_id in (select p.id from public.patients p where public.is_family_member(p.family_id))
    and deleted_at is null
  );
create policy "editors can insert medications" on public.medications for insert
  with check (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
  );
create policy "editors can update medications" on public.medications for update
  using (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
    and deleted_at is null
  );

-- ---------- APPOINTMENTS ----------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  parent_appointment_id uuid references public.appointments(id) on delete set null,
  type text not null check (type in ('consultation','exam','return','procedure','therapy','vaccine','other')),
  title text not null,
  scheduled_at timestamptz not null,
  location text,
  address text,
  map_url text,
  doctor_name text,
  specialty text,
  responsible_user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('scheduled','confirmed','done','cancelled','rescheduled')),
  notes text,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_appointments_patient_id on public.appointments(patient_id);
create index idx_appointments_scheduled_at on public.appointments(scheduled_at);
create index idx_appointments_status on public.appointments(status);
create index idx_appointments_deleted_at on public.appointments(deleted_at);

grant select, insert, update on public.appointments to authenticated;
grant all on public.appointments to service_role;

alter table public.appointments enable row level security;

create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

create policy "members can read appointments" on public.appointments for select
  using (
    patient_id in (select p.id from public.patients p where public.is_family_member(p.family_id))
    and deleted_at is null
  );
create policy "editors can insert appointments" on public.appointments for insert
  with check (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
  );
create policy "editors can update appointments" on public.appointments for update
  using (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
    and deleted_at is null
  );

-- ---------- CLINICAL_EVENTS ----------
create table public.clinical_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  event_date date not null,
  type text not null check (type in (
    'consultation','exam','hospitalization','surgery','symptom',
    'fall_accident','medication_change','diagnosis','return',
    'crisis','vaccine','family_note'
  )),
  title text not null,
  description text,
  severity text check (severity in ('low','medium','high','critical')),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_clinical_events_patient_id on public.clinical_events(patient_id);
create index idx_clinical_events_event_date on public.clinical_events(event_date);
create index idx_clinical_events_deleted_at on public.clinical_events(deleted_at);

grant select, insert, update on public.clinical_events to authenticated;
grant all on public.clinical_events to service_role;

alter table public.clinical_events enable row level security;

create trigger clinical_events_updated_at before update on public.clinical_events
  for each row execute function public.set_updated_at();

create policy "members can read clinical_events" on public.clinical_events for select
  using (
    patient_id in (select p.id from public.patients p where public.is_family_member(p.family_id))
    and deleted_at is null
  );
create policy "editors can insert clinical_events" on public.clinical_events for insert
  with check (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
  );
create policy "editors can update clinical_events" on public.clinical_events for update
  using (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
    and deleted_at is null
  );

-- ---------- DOCUMENTS ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  title text not null,
  type text not null check (type in (
    'prescription','exam','report','medical_request','insurance_card',
    'id_document','discharge','vaccine','medication_photo','other'
  )),
  file_path text not null,
  file_mime_type text,
  file_size_bytes bigint,
  document_date date,
  expiry_date date,
  institution text,
  doctor_name text,
  clinical_event_id uuid references public.clinical_events(id) on delete set null,
  tags text[],
  ocr_text text,
  ai_summary text,
  search_vector tsvector generated always as (
    to_tsvector('portuguese',
      coalesce(title,'') || ' ' ||
      coalesce(doctor_name,'') || ' ' ||
      coalesce(institution,'') || ' ' ||
      coalesce(ocr_text,'')
    )
  ) stored,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_documents_patient_id on public.documents(patient_id);
create index idx_documents_type on public.documents(type);
create index idx_documents_deleted_at on public.documents(deleted_at);
create index idx_documents_fts on public.documents using gin(search_vector);

grant select, insert, update on public.documents to authenticated;
grant all on public.documents to service_role;

alter table public.documents enable row level security;

create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

create policy "members can read documents" on public.documents for select
  using (
    patient_id in (select p.id from public.patients p where public.is_family_member(p.family_id))
    and deleted_at is null
  );
create policy "editors can insert documents" on public.documents for insert
  with check (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
  );
create policy "editors can update documents" on public.documents for update
  using (
    patient_id in (select p.id from public.patients p where public.has_family_role(p.family_id, array['admin','editor']))
    and deleted_at is null
  );

-- ---------- EMERGENCY_LINKS ----------
create table public.emergency_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz,
  is_active boolean default true,
  access_count int default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index idx_emergency_links_token on public.emergency_links(token);

grant select, insert, update, delete on public.emergency_links to authenticated;
grant all on public.emergency_links to service_role;

alter table public.emergency_links enable row level security;

create policy "members can manage emergency_links" on public.emergency_links for all
  using (
    patient_id in (
      select p.id from public.patients p
      join public.family_members fm on fm.family_id = p.family_id
      where fm.user_id = auth.uid() and fm.status = 'active'
    )
  );

-- ---------- ACCESS_LOGS ----------
-- ip_address is personal data (LGPD): schedule pg_cron purge for created_at < now() - interval '90 days'
create table public.access_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  emergency_link_id uuid references public.emergency_links(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create index idx_access_logs_patient_id on public.access_logs(patient_id);
create index idx_access_logs_created_at on public.access_logs(created_at);

-- Only service_role can write access_logs (via server functions). Authenticated may read own-family logs.
grant select on public.access_logs to authenticated;
grant all on public.access_logs to service_role;

alter table public.access_logs enable row level security;

create policy "members can read own family access_logs" on public.access_logs for select
  using (family_id is not null and public.is_family_member(family_id));

-- ---------- AUTH TRIGGER: auto-create profile on signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- STORAGE: private bucket + policies ----------
insert into storage.buckets (id, name, public)
values ('medical-documents', 'medical-documents', false)
on conflict (id) do nothing;

-- File path convention: {family_id}/{patient_id}/{filename}
-- Members of the patient's family can read/write; only family editors+admins can write.
create policy "family members can read medical-documents"
on storage.objects for select
using (
  bucket_id = 'medical-documents'
  and (storage.foldername(name))[2] in (
    select p.id::text from public.patients p
    join public.family_members fm on fm.family_id = p.family_id
    where fm.user_id = auth.uid() and fm.status = 'active'
  )
);

create policy "family editors can write medical-documents"
on storage.objects for insert
with check (
  bucket_id = 'medical-documents'
  and (storage.foldername(name))[2] in (
    select p.id::text from public.patients p
    join public.family_members fm on fm.family_id = p.family_id
    where fm.user_id = auth.uid()
      and fm.status = 'active'
      and fm.role in ('admin','editor')
  )
);

create policy "family editors can update medical-documents"
on storage.objects for update
using (
  bucket_id = 'medical-documents'
  and (storage.foldername(name))[2] in (
    select p.id::text from public.patients p
    join public.family_members fm on fm.family_id = p.family_id
    where fm.user_id = auth.uid()
      and fm.status = 'active'
      and fm.role in ('admin','editor')
  )
);

create policy "family editors can delete medical-documents"
on storage.objects for delete
using (
  bucket_id = 'medical-documents'
  and (storage.foldername(name))[2] in (
    select p.id::text from public.patients p
    join public.family_members fm on fm.family_id = p.family_id
    where fm.user_id = auth.uid()
      and fm.status = 'active'
      and fm.role in ('admin','editor')
  )
);
