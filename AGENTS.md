# Repository Guidance

## Project Shape
- This is a TypeScript MCP server for Jellyfin.
- Runtime code lives in `src/`, grouped by MCP tool area under `src/tools/`.
- `src/client.ts` owns direct Jellyfin HTTP calls. Tool files should call the client rather than building URLs themselves.
- Minimal Jellyfin response types live in `src/types.ts`. Add only the fields this MCP reads or writes.
- Tests live in `tests/` and use Vitest with fetch and MCP server doubles.

## Implementation Rules
- Keep tool behavior typed with Zod schemas and return through `ok`, `fail`, or `refuseUnconfirmed` from `src/tools/_util.ts`.
- Destructive or privileged operations must require explicit confirmation and should return a clear refusal when confirmation is missing.
- Prefer user-scoped Jellyfin APIs when behavior depends on watched, resume, favorite, or visibility state.
- Preserve existing user data fields when updating a subset of Jellyfin user data unless the endpoint is known to patch safely.
- Do not add dependencies without asking first.

## Verification
- For focused client or tool changes, run the smallest meaningful Vitest target first.
- Before claiming repo-wide success after code changes, run `npm run typecheck` and the relevant tests, or report the exact blocker.

## Documentation
- Keep README tool counts and feature lists in sync with registered tools.
- Use plain ASCII punctuation. Do not use em dashes.

## Memory Handoffs
- For substantial tasks, write a standard memory handoff under `.claude/memory-handoffs/`.
- Follow `~/.openclaw/workspace/docs/claude-code-memory-handoff.md`.
- Do not edit `MEMORY.md` directly.
