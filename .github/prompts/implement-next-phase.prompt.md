---
mode: agent
description: Implement the next pending phase from tasks.md, create a feature branch, and open a PR. Stops after one phase to stay within context limits.
---

## Purpose

Implement exactly **one** phase of pending tasks from `specs/001-sky-defense-core/tasks.md`,
commit all changes to a dedicated feature branch, and open a GitHub PR for review.
**Stop immediately after the PR is created** — do not proceed to the next phase.

---

## Step 1 — Identify the next pending phase

Read `specs/001-sky-defense-core/tasks.md` and find the **phase table** (look for `| Ph10-` rows).

For each phase row, check whether **all tasks listed in that row** are marked `[X]` in the task list above.
Select the **first phase that has at least one `[ ]` task remaining**.

Rules:
- Skip any phase whose tasks are all marked `[X]`.
- A task marked `[BLOCKED` stays blocked — do not attempt it; treat it as if `[X]` for phase-completeness purposes.
- If no pending phase is found, report "All phases complete — nothing to do." and stop.

Output the selected phase name (e.g. `Ph10-D`) and its task IDs before proceeding.

---

## Step 2 — Read current file state

Before writing any code, read every source file that the selected phase's tasks will modify.
Use `read_file` for all relevant files in parallel. Do **not** guess file contents.

Also read `src/core/entities.ts`, `src/core/config.ts`, `src/core/events.ts` if the phase touches
interfaces — these define the types everything else depends on.

---

## Step 3 — Create a feature branch

```
git checkout main
git pull
git checkout -b phase-<id>-<short-slug> main
```

Use the phase ID and a 2–4 word kebab-case slug from the phase description.
Example: `phase-10d-storage-remote-config`

---

## Step 4 — Implement all non-blocked tasks for this phase

For each non-blocked `[ ]` task in the phase (in dependency order):

1. **Read** any additional files needed (never edit what you haven't read).
2. **Edit** — use `multi_replace_string_in_file` for multiple edits in one call.
3. **Follow all project rules**:
   - No browser APIs (`new Date()`, `setTimeout`, `localStorage`, `navigator.*`) in `src/core/` — adapters only.
   - No `setTimeout` for gameplay timing — use per-step `dt` accumulator (Constitution Rule 7).
   - No hardcoded secrets or PII.
   - Touch targets ≥ 48 px (FR-024).
   - Ads only at natural breaks (Constitution Rule 28).
4. After implementing each task, immediately check for TypeScript errors with `npx tsc --noEmit`.
   Fix any errors before moving to the next task.

Mark blocked tasks with a note; do not skip them silently.

---

## Step 5 — Compile + test checkpoint

```powershell
npx tsc --noEmit
npx vitest run
```

All pre-existing tests **must** pass. If any test fails, fix the regression before continuing.
Do not proceed to commit if there are TS errors or failing tests.

---

## Step 6 — Update tasks.md

Mark each implemented task `[X]` in `specs/001-sky-defense-core/tasks.md`.
Leave blocked tasks as `[ ]` with their existing `[BLOCKED` label.

---

## Step 7 — Commit

```
git add -A
git commit -m "phase <id>: <one-line summary>

- T0XX: <what was done>
- T0YY: <what was done>
- T0ZZ: [BLOCKED — <reason>]
- <N>/76 tests pass (or N+M if new tests added), 0 TS errors"
```

---

## Step 8 — Push and open PR

```powershell
git push -u origin <branch-name>
```

Then create a PR via the GitHub REST API (token is already in `$env:GH_TOKEN`; if not set, retrieve
it from the Windows Credential Manager as shown in previous sessions):

```powershell
$body = @{
  title = "Phase <ID>: <short description>"
  head  = "<branch-name>"
  base  = "main"
  body  = "<multi-line description of all tasks, test results, constitution compliance notes>"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://api.github.com/repos/carlesapps9/ironwallsky/pulls" `
  -Method Post `
  -Headers @{ Authorization = "token $env:GH_TOKEN"; Accept = "application/vnd.github.v3+json" } `
  -Body $body `
  -ContentType "application/json"
```

If `$env:GH_TOKEN` is not set, retrieve it first:

```powershell
$code = @'
using System; using System.Runtime.InteropServices; using System.Text;
public class CredMgr2 {
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool CredRead(string target, int type, int flags, out IntPtr credential);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  struct CREDENTIAL { public uint Flags; public int Type; public IntPtr TargetName; public IntPtr Comment; public long LastWritten; public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist; public uint AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName; }
  public static string GetPassword(string target) {
    IntPtr ptr; if (!CredRead(target, 1, 0, out ptr)) return null;
    var c = Marshal.PtrToStructure<CREDENTIAL>(ptr);
    if (c.CredentialBlobSize == 0) return "";
    byte[] buf = new byte[(int)c.CredentialBlobSize]; Marshal.Copy(c.CredentialBlob, buf, 0, buf.Length);
    return Encoding.Unicode.GetString(buf); } }
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
$env:GH_TOKEN = [CredMgr2]::GetPassword("git:https://github.com")
```

---

## Step 9 — Stop

Output a concise summary:
- Phase implemented
- Tasks completed / blocked
- PR URL
- Which phase is next (but do **not** start it)

**Do not implement the next phase.** The user will trigger a new invocation.
This keeps each conversation focused and within context limits.
