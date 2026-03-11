# ironwallsky

## Security

### Running an audit

```sh
npm audit
```

Findings at **high** or **critical** severity will also fail CI automatically (see `.github/workflows/ci.yml` → `Security audit` step).

### Accepted-risk findings

The `minimatch` CVE (GHSA-f8q6-p94x-37v3) surfaces via `replace > minimatch`.
It is accepted at current risk level because:

- `minimatch` is only invoked at build time (glob pattern matching inside the `replace` dev-tool), never at runtime.
- End-users have no ability to supply input to the vulnerable code path.
- The override `"replace>minimatch": "^5.1.0"` in `package.json` pins the patched version, reducing residual risk to near zero.

### Planned upgrade

Capacitor 6 → 8 is planned as a future major upgrade (see `specs/main/tasks-capacitor8-upgrade.md`). That upgrade will fully resolve the `tar` CVEs that currently appear only at `moderate` severity in audit results.
