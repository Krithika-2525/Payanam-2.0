# Supabase integration boundary

Deferred as requested. No Supabase project was created, modified or billed, and no publishable or secret key is required by this release. The current app saves journeys to this browser, with JSON export/import for portability.

When the project ID is supplied:

1. Inspect that project and its existing schema; agree which data belongs to individual travelers vs operators.
2. Add Supabase Auth using a pinned client version and the project URL/publishable key. The service-role/secret key never belongs in VITE_ variables or browser source.
3. Create versioned `journeys` storage with `id uuid`, `owner_id uuid references auth.users(id)`, `plan jsonb`, `schema_version`, `created_at`, and `updated_at`. Index owner_id and creation time. Keep consented traveler preferences private.
4. Enable RLS. Grant authenticated access only as needed, with SELECT/DELETE USING auth.uid() = owner_id, INSERT WITH CHECK auth.uid() = owner_id, and UPDATE with both predicates. Restrict plan shape and size. Do not use user_metadata for authorization.
5. Introduce a storage adapter matching current list/save/delete operations. Offer explicit migration of local saved plans after sign-in rather than silently uploading them.
6. Verify two different accounts cannot read or alter one another's journeys; test expired tokens, sign-out, offline state, private sharing, and rollback.
7. Generate migrations through the current Supabase CLI after inspecting its help; run advisors and live verification. Register Vercel redirect URLs and choose deployment regions near the actual project.

Current docs reviewed: [changelog](https://supabase.com/changelog), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [securing the Data API](https://supabase.com/docs/guides/api/securing-your-api). Schema design above is a proposal, not an applied migration.
