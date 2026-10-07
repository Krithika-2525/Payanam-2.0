# Data and deletion

The public city snapshot contains no traveler data. GeoNames attribution and source retrieval date accompany each result. Detailed provider search stays disabled until a qualified free account and durable database are connected.

Drafts remain in memory until the traveler explicitly chooses **Keep draft on this device**. That action uses versioned browser storage, capped at 50 drafts/2 MB. A shared device can expose local drafts to other people using that browser. **About & free plan → Clear device drafts** removes them; individual drafts also have a delete control. Exports are traveler-managed files and are not removed by account deletion.

Signing in never uploads a draft automatically. **Save to cloud** explicitly uploads it. Each cloud route verifies a JWT and PostgreSQL enforces owner policies, even when a pooled connection is reused. Sign-out clears the cloud list and active cloud draft. Local drafts explicitly saved to the device remain until deleted.

Trip deletion removes its days, items, revisions, idempotency responses, events and original legacy envelope in the same database transaction. **Delete my Payanam cloud data** removes all trips and deactivates Payanam access immediately. An issuer/subject identity tombstone remains to prevent an existing valid token from recreating the account. This does not delete the separately managed Supabase Auth account; the project owner must remove that identity and associated backup copies under the final production retention policy.

Provider responses expire from use after one day. Quota entries must remain for at least three days; never erase current quota records during a reset. Physical cache/usage cleanup and encrypted backups are operator tasks until a production target exists. Private revision/idempotency storage currently persists until trip deletion: monitor database size before enabling public sign-ups. No claim of a finalized commercial retention policy is made.

On-device translation sends no text to Payanam. It depends on browser support and language-model downloads; unsupported pairs show an unavailable state. Tamil interface text is a preview pending native review. Requests do not log tokens or traveler text; production start uses `--no-access-log`. Hosting providers still maintain their own operational records.
