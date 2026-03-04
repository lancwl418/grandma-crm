# Supabase Migration Plan (GrandmaCRM)

This is the execution plan to move from in-memory/sample data + Firestore tools to Supabase/Postgres as the single source of truth.

## 0. Prerequisites

1. Create a Supabase project.
2. Run [`001_init_crm.sql`](/Users/linda/Desktop/grandma-crm/docs/supabase/001_init_crm.sql) in SQL Editor.
3. Enable Email auth (or your preferred auth provider).
4. Create a service role key for backend functions.

## 1. Environment Variables

### Frontend `.env.local`

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_DATA_PROVIDER=supabase
VITE_AI_TOOL_ENDPOINT=/api/runTool
VITE_AI_TOOL_USER_ID=<uuid-user-id-for-dev>
```

### Functions `functions/.env`

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
DATA_PROVIDER=supabase
```

## 2. Backend Migration (Functions)

1. Add a `data` layer under `functions/src/data`:
   - `clientRepository.ts`
   - `taskRepository.ts`
   - `aiLogRepository.ts`
2. Update tools to write/read Postgres:
   - `crm.searchClient` -> `clients`
   - `crm.openClient` -> `clients`
   - `crm.updateClient` -> `clients`
   - `task.create` -> `tasks` + optional `client_logs`
3. Log every AI tool call into `ai_actions_log` with `trace_id`.
4. Keep Firestore path behind a feature flag only during transition.

## 3. Frontend Migration

1. Create `src/crm/data/clientRepository.ts`:
   - `listClients`
   - `getClient`
   - `updateClient`
   - `addClientLog`
2. In these pages, replace local sample source as primary:
   - `src/pages/AssistantDashboard.tsx`
   - `src/pages/Dashboard.tsx`
   - `src/pages/RealEstateCRM.tsx`
3. Keep sample fallback only when env is missing.
4. Use optimistic updates but always reconcile with server response.

## 4. AI Memory Integration

1. `ai_sessions`:
   - write/read `last_client_id`, `last_intent`, `pending_draft`, `turn_count`.
2. `client_memories`:
   - only write after user confirmation.
3. Parse API:
   - inject minimal `sessionHints` from `ai_sessions`.

## 5. Cutover Strategy

1. Phase A: dual-write (`Firestore + Supabase`) for `task.create` and `crm.updateClient`.
2. Phase B: read from Supabase first; if empty, fallback Firestore.
3. Phase C: disable Firestore writes.
4. Phase D: remove Firestore path.

## 6. Verification Checklist

1. Parse API returns `traceId` and successful tool invocation is logged in `ai_actions_log`.
2. Chat command `明天提醒我给王小明打电话` creates a row in `tasks`.
3. Chat command `把王小明状态改为看房中` updates `clients.status`.
4. RLS check: user A cannot read/write user B records.
5. Reminder worker can fetch `pending` jobs due before now.

## 7. Rollback Plan

1. Keep `VITE_DATA_PROVIDER` switchable (`sample|supabase`) for UI.
2. Keep `DATA_PROVIDER` switchable (`firestore|supabase`) for functions.
3. If errors spike, flip both providers back without code revert.
