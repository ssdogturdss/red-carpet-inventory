# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest on `main` | ✅ Active |
| Older tags | ❌ No backports |

Only the most recent release receives security fixes. Update to the latest version before reporting an issue.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately via **[GitHub Security Advisories](../../security/advisories/new)**. This keeps details confidential until a fix is ready.

Include:
- A clear description of the vulnerability
- Steps to reproduce
- Potential impact (data exposure, auth bypass, etc.)
- Any suggested fix or mitigation

You can expect an acknowledgement within **48 hours** and a status update within **7 days**.

## Scope

| In scope | Out of scope |
|----------|-------------|
| Authentication / PIN bypass | Issues in Expo Go itself |
| Unauthorised access to inventory data | Third-party library CVEs (report upstream) |
| SQL injection / data exfiltration | Rate-limiting / DDoS on dev environments |
| Push-token leakage | Social engineering |
| Admin PIN exposure in logs | Scanner hardware |
| Insecure API endpoints | |

## Security Design Notes

- **Admin PIN** — stored only in the `ADMIN_PIN` environment variable on the server; never in client code or logs.
- **User PINs** — hashed with scrypt (N=16384, r=8, p=1) before storage; legacy SHA-256 hashes are upgraded on next login.
- **Push tokens** — stored server-side only; never returned to unauthorised callers.
- **Session tokens** — random 32-byte hex tokens; invalidated on logout.
- **Supply chain** — `pnpm` is configured with `minimumReleaseAge: 1440` (packages must be at least 1 day old before installation).
- **Database** — all queries use Drizzle ORM parameterised queries; no raw string interpolation in SQL.
