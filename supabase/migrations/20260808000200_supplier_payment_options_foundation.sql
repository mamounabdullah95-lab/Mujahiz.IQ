-- Ninth local SQL slice: empty reviewed Supplier payment-option foundation only.
-- This migration creates no payment data, mappings, RLS, API access, projection, or mutation routine.

create table public.supplier_payment_options (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  supplier_profile_id uuid not null,
  option_type text not null,
  method_code text,
  currency_code text,
  credit_availability_code text,
  credit_days integer,
  credit_start_code text,
  timing_code text,
  advance_percentage numeric(5,2),
  position integer not null default 0,
  record_status text not null default 'draft',
  source_type text not null,
  source_namespace text not null,
  evidence_reference text,
  mapping_version text,
  confidence_level text,
  review_note text,
  reviewed_by_user_profile_id uuid,
  reviewed_at timestamptz,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_by_user_profile_id uuid,
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_by_user_profile_id uuid,
  constraint supplier_payment_options_option_type_ck check (
    option_type in ('method', 'settlement_currency', 'credit_term', 'payment_timing')
  ),
  constraint supplier_payment_options_method_code_ck check (
    method_code is null or method_code in ('cash', 'bank_transfer', 'cheque', 'letter_of_credit')
  ),
  constraint supplier_payment_options_currency_code_ck check (
    currency_code is null or currency_code in ('IQD', 'USD')
  ),
  constraint supplier_payment_options_credit_availability_code_ck check (
    credit_availability_code is null or credit_availability_code in ('credit_offered', 'credit_not_offered')
  ),
  constraint supplier_payment_options_credit_days_ck check (
    credit_days is null or credit_days between 1 and 365
  ),
  constraint supplier_payment_options_credit_start_code_ck check (
    credit_start_code is null or credit_start_code in ('invoice_date', 'delivery_acceptance_date')
  ),
  constraint supplier_payment_options_timing_code_ck check (
    timing_code is null or timing_code = 'advance_payment'
  ),
  constraint supplier_payment_options_advance_percentage_ck check (
    advance_percentage is null or advance_percentage between 1 and 100
  ),
  constraint supplier_payment_options_semantic_shape_ck check (
    (
      option_type = 'method'
      and method_code is not null
      and currency_code is null
      and credit_availability_code is null
      and credit_days is null
      and credit_start_code is null
      and timing_code is null
      and advance_percentage is null
    )
    or (
      option_type = 'settlement_currency'
      and method_code is null
      and currency_code is not null
      and credit_availability_code is null
      and credit_days is null
      and credit_start_code is null
      and timing_code is null
      and advance_percentage is null
    )
    or (
      option_type = 'credit_term'
      and method_code is null
      and currency_code is null
      and timing_code is null
      and advance_percentage is null
      and (
        (
          credit_availability_code = 'credit_offered'
          and credit_days is not null
          and credit_start_code is not null
        )
        or (
          credit_availability_code = 'credit_not_offered'
          and credit_days is null
          and credit_start_code is null
        )
      )
    )
    or (
      option_type = 'payment_timing'
      and method_code is null
      and currency_code is null
      and credit_availability_code is null
      and credit_days is null
      and credit_start_code is null
      and timing_code = 'advance_payment'
    )
  ),
  constraint supplier_payment_options_position_ck check (
    position >= 0
  ),
  constraint supplier_payment_options_record_status_ck check (
    record_status in ('draft', 'active', 'superseded', 'archived')
  ),
  constraint supplier_payment_options_source_type_ck check (
    source_type in ('legacy_migration', 'import_submission', 'supplier_proposal', 'manual_curation')
  ),
  constraint supplier_payment_options_source_namespace_ck check (
    source_namespace ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_payment_options_evidence_reference_ck check (
    evidence_reference is null
    or (octet_length(btrim(evidence_reference)) between 1 and 512 and evidence_reference = btrim(evidence_reference))
  ),
  constraint supplier_payment_options_mapping_version_ck check (
    mapping_version is null or mapping_version ~ '^[a-z][a-z0-9_]{0,62}$'
  ),
  constraint supplier_payment_options_confidence_level_ck check (
    confidence_level is null or confidence_level in ('high', 'medium', 'low')
  ),
  constraint supplier_payment_options_review_note_ck check (
    review_note is null or (octet_length(btrim(review_note)) between 1 and 1000 and review_note = btrim(review_note))
  ),
  constraint supplier_payment_options_review_provenance_ck check (
    (reviewed_by_user_profile_id is null) = (reviewed_at is null)
  ),
  constraint supplier_payment_options_transformation_versions_ck check (
    (
      source_type in ('legacy_migration', 'import_submission')
      and mapping_version is not null
    )
    or (
      source_type in ('supplier_proposal', 'manual_curation')
      and mapping_version is null
    )
  ),
  constraint supplier_payment_options_lifecycle_shape_ck check (
    (
      record_status = 'draft'
      and valid_from is null
      and valid_until is null
    )
    or (
      record_status = 'active'
      and reviewed_by_user_profile_id is not null
      and valid_from is not null
      and valid_until is null
    )
    or (
      record_status = 'superseded'
      and reviewed_by_user_profile_id is not null
      and valid_from is not null
      and valid_until > valid_from
    )
    or (
      record_status = 'archived'
      and (
        (valid_from is null and valid_until is null)
        or (reviewed_by_user_profile_id is not null and valid_from is not null and valid_until > valid_from)
      )
    )
  ),
  constraint supplier_payment_options_timestamp_order_ck check (
    updated_at >= created_at
  ),
  constraint supplier_payment_options_supplier_profile_fk foreign key (supplier_profile_id)
    references public.supplier_profiles (id) on delete restrict,
  constraint supplier_payment_options_reviewed_by_fk foreign key (reviewed_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_payment_options_created_by_fk foreign key (created_by_user_profile_id)
    references public.user_profiles (id) on delete restrict,
  constraint supplier_payment_options_updated_by_fk foreign key (updated_by_user_profile_id)
    references public.user_profiles (id) on delete restrict
);

comment on table public.supplier_payment_options is
  'Trusted-only empty local reviewed Supplier payment-option assertions. Options are indicative profile claims, not RFQ, quotation, purchase-order, invoice, or contract terms. This table has no rows, mapping execution, trusted mutation routine, RLS, API/browser grant, Auth bridge, projection, search behavior, or client integration.';
comment on column public.supplier_payment_options.id is
  'Database-generated UUIDv4 payment-option identity. Deterministic source child identity belongs to the later approved migration-control and transformation boundary.';
comment on column public.supplier_payment_options.supplier_profile_id is
  'Required restrictive Supplier aggregate root. A payment option establishes no ownership, verification, eligibility, bank detail, payment instruction, or transaction term.';
comment on column public.supplier_payment_options.option_type is
  'One mutually exclusive assertion shape: method, settlement_currency, credit_term, or payment_timing.';
comment on column public.supplier_payment_options.method_code is
  'Controlled indicative method: cash, bank_transfer, cheque, or letter_of_credit. Cheque and letter of credit imply no additional contractual conditions.';
comment on column public.supplier_payment_options.currency_code is
  'Controlled uppercase indicative settlement currency: IQD or USD. It is not a quotation price, exchange rate, or method-to-currency commitment.';
comment on column public.supplier_payment_options.credit_availability_code is
  'credit_offered records one exact reviewed days/start pair; credit_not_offered is the sole explicit negative. Absence of a credit row remains unknown.';
comment on column public.supplier_payment_options.credit_days is
  'Whole calendar days from the exact approved start event, bounded 1 through 365. It does not define business days, a due timestamp, interest, or enforceable terms.';
comment on column public.supplier_payment_options.credit_start_code is
  'Exact approved event only: invoice_date or delivery_acceptance_date. Ambiguous legacy Firebase labels are not inferred into either code.';
comment on column public.supplier_payment_options.timing_code is
  'advance_payment is a separate indicative timing arrangement, not a payment method, currency, credit plan, deposit receipt, or default requirement.';
comment on column public.supplier_payment_options.advance_percentage is
  'Optional reviewed advance percentage, bounded 1 through 100 when present. Null means no reviewed percentage is proven and never means 100 percent.';
comment on column public.supplier_payment_options.position is
  'Non-negative active-set presentation order only. It is not identity, preference, precedence, a default commercial term, or a ranking.';
comment on column public.supplier_payment_options.record_status is
  'Payment-option lifecycle: draft, active, superseded, archived. Partial indexes enforce active same-shape conflicts; trusted future operations own cross-row credit exclusion and authority.';
comment on column public.supplier_payment_options.source_type is
  'Trusted bounded decision source: reviewed legacy migration, reviewed import/submission, Supplier proposal, or manual curation. Browser identity is never authoritative.';
comment on column public.supplier_payment_options.evidence_reference is
  'Optional bounded internal or repository reference to reviewed evidence. It must not contain a raw workbook, complete Supplier payload, secret, credential, contact, bank, instrument, or public evidence URL.';
comment on column public.supplier_payment_options.mapping_version is
  'Required for reviewed transformed legacy/import candidates and absent for Supplier proposals or manual curation.';
comment on column public.supplier_payment_options.review_note is
  'Optional bounded restricted review evidence. It cannot create an option, repair a contradiction, supply a missing parameter, or enter a client projection.';
comment on column public.supplier_payment_options.reviewed_by_user_profile_id is
  'Reviewer provenance required before activation. A later trusted mutation path owns reviewer authority; this no-trigger slice creates no authorization behavior.';
comment on column public.supplier_payment_options.valid_from is
  'Activation date. It is not a freshness, expiry, review-cadence, or stale-row field.';
comment on column public.supplier_payment_options.valid_until is
  'Exclusive terminal date for a reviewed active-history closure. It is later than valid_from and absent while active; it is not an invented expiry.';
comment on column public.supplier_payment_options.created_by_user_profile_id is
  'Nullable trusted creation provenance. Null permits synthetic migration/bootstrap states without fabricating an actor.';
comment on column public.supplier_payment_options.updated_by_user_profile_id is
  'Nullable trusted update provenance. Null permits synthetic migration/bootstrap states without fabricating an actor.';

create unique index supplier_payment_options_active_method_uidx
  on public.supplier_payment_options (supplier_profile_id, method_code)
  where record_status = 'active' and option_type = 'method';

create unique index supplier_payment_options_active_currency_uidx
  on public.supplier_payment_options (supplier_profile_id, currency_code)
  where record_status = 'active' and option_type = 'settlement_currency';

create unique index supplier_payment_options_active_credit_offered_uidx
  on public.supplier_payment_options (supplier_profile_id, credit_days, credit_start_code)
  where record_status = 'active'
    and option_type = 'credit_term'
    and credit_availability_code = 'credit_offered';

create unique index supplier_payment_options_active_credit_not_offered_uidx
  on public.supplier_payment_options (supplier_profile_id)
  where record_status = 'active'
    and option_type = 'credit_term'
    and credit_availability_code = 'credit_not_offered';

create unique index supplier_payment_options_active_advance_uidx
  on public.supplier_payment_options (supplier_profile_id, (coalesce(advance_percentage, '-1'::numeric)))
  where record_status = 'active' and option_type = 'payment_timing';

create unique index supplier_payment_options_active_position_uidx
  on public.supplier_payment_options (supplier_profile_id, position)
  where record_status = 'active';

create index supplier_payment_options_supplier_status_type_position_idx
  on public.supplier_payment_options (supplier_profile_id, record_status, option_type, position, id);

create index supplier_payment_options_type_status_supplier_idx
  on public.supplier_payment_options (option_type, record_status, supplier_profile_id, id);

revoke all on table public.supplier_payment_options from public, anon, authenticated, service_role;
