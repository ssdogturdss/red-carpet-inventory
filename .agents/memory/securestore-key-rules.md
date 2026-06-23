---
name: SecureStore key naming rules
description: expo-secure-store rejects keys with @ or other special characters — only alphanumeric, dot, dash, underscore allowed
---

## Rule

`expo-secure-store` validates key names at runtime and throws:
> "Invalid key provided to SecureStore. Keys must not be empty and contain only alphanumeric characters, '.', '-', and '_'."

## What to avoid

- Never prefix keys with `@` (e.g. `@rci_user_token_v1` → invalid)
- No spaces, slashes, colons, or any other punctuation

## Safe pattern

`snake_case_with_v2` style: `rci_user_token_v2`, `admin_session_v1`

**Why:** The error is silent until runtime on a native device — it won't show during web development (web uses localStorage which accepts any key). Caught in production causing a crash-on-startup loop.

**How to apply:** Any time a new SecureStore key is introduced, confirm the name matches `[A-Za-z0-9._-]+` before shipping.
