GRANT EXECUTE ON FUNCTION
claim_security.current_privileged_actor_v1()
TO mujahiz_claim_human_command_owner;

GRANT EXECUTE ON FUNCTION
claim_security.privileged_actor_for_profile_v1(uuid)
TO mujahiz_claim_human_command_owner;

REVOKE EXECUTE ON FUNCTION
claim_security.current_privileged_actor_v1()
FROM postgres;

REVOKE EXECUTE ON FUNCTION
claim_security.privileged_actor_for_profile_v1(uuid)
FROM postgres;
