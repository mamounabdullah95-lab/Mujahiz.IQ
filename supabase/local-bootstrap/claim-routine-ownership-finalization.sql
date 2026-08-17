ALTER FUNCTION supplier_claim.reserve_submit(text, uuid, text, text, jsonb, uuid)
OWNER TO mujahiz_claim_human_command_owner;
ALTER FUNCTION supplier_claim.submit(text, uuid, text, text, jsonb, uuid, uuid, uuid)
OWNER TO mujahiz_claim_human_command_owner;
ALTER FUNCTION supplier_claim.reserve_withdraw(text, uuid, integer)
OWNER TO mujahiz_claim_human_command_owner;
ALTER FUNCTION supplier_claim.withdraw(text, uuid, integer, uuid, uuid)
OWNER TO mujahiz_claim_human_command_owner;
ALTER FUNCTION supplier_claim.reserve_assign_reviewer(text, uuid, integer, uuid)
OWNER TO mujahiz_claim_human_command_owner;
ALTER FUNCTION supplier_claim.assign_reviewer(text, uuid, integer, uuid, uuid, uuid)
OWNER TO mujahiz_claim_human_command_owner;
ALTER FUNCTION supplier_claim.reject(text, uuid, integer, integer, text, text, text, text, text, uuid)
OWNER TO mujahiz_claim_human_command_owner;
ALTER FUNCTION supplier_claim._execute_reject(text, uuid, integer, integer, text, text, text, text, text, uuid, uuid)
OWNER TO mujahiz_claim_human_command_owner;
ALTER FUNCTION supplier_claim.approve(text, uuid, integer, integer, text, text, text, text[], text, uuid)
OWNER TO mujahiz_claim_human_command_owner;
ALTER FUNCTION supplier_claim._execute_approve(text, uuid, integer, integer, text, text, text, text[], text, uuid, uuid)
OWNER TO mujahiz_claim_human_command_owner;
ALTER FUNCTION supplier_claim._claim_history_envelope_coherent_v1(uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim._claim_assignment_history_coherent_v1(uuid, boolean)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim._withdrawn_history_coherent_v1(uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim._rejected_history_coherent_v1(uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim._approval_ownership_history_coherent_v1(uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim._approval_audit_history_coherent_v1(uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim._approval_competitor_history_coherent_v1(uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim._approved_history_coherent_v1(uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim._expired_history_coherent_v1(uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim._superseded_history_coherent_v1(uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim._terminal_history_coherent_v1(uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim._active_claim_history_coherent_v1(uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim.expire(text, uuid, integer, uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION supplier_claim._execute_expire(text, uuid, integer, uuid, uuid)
OWNER TO mujahiz_claim_expiry_command_owner;
ALTER FUNCTION claim_security.target_supplier_conflict_v1(uuid, uuid, uuid)
OWNER TO mujahiz_claim_target_conflict_helper_owner;
ALTER FUNCTION claim_security.reviewer_prior_claim_context_v1(uuid, uuid, uuid)
OWNER TO mujahiz_claim_reviewer_prior_context_helper_owner;
