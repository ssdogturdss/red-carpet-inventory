# Threat Model

## Project Overview

The production application is a public chemical inventory system for store employees and administrators. The main production trust boundary is the Express API in `artifacts/api-server`, which serves the Expo mobile/web client in `artifacts/mobile` and persists data in PostgreSQL through Drizzle ORM. The mockup sandbox under `artifacts/mockup-sandbox` is treated as dev-only and out of scope unless production reachability is demonstrated.

Production assumptions for this scan:
- The deployed app is public on the internet.
- `NODE_ENV` is `production` in deployed environments.
- Replit terminates TLS for deployed traffic.
- Replit Secrets store is the source of production secrets.

## Assets

- **Operational inventory data** — weekly counts, on-hand quantities, deliveries, pulls, purchase orders, alerts, and trend reports. This data drives store operations and should not be modifiable or enumerable by unauthorized parties.
- **User accounts and sessions** — employee identities, PIN-derived authenticators, session tokens, and role/store assignments. Compromise allows impersonation and unauthorized data access.
- **Administrative controls** — admin-only user management, bot settings, push receipt visibility, and other management actions. Compromise enables full application takeover.
- **Notification contact data** — email addresses and phone numbers used for operational alerts. This is sensitive contact data and also a cost-bearing communication channel.
- **Application secrets and third-party capabilities** — database credentials, SMTP/Twilio credentials, Expo push access, and OpenAI integration access. Abuse can leak data or generate cost.

## Trust Boundaries

- **Mobile/web client to API** — every request from `artifacts/mobile` crosses into the Express API. The client is untrusted and cannot enforce authentication, authorization, rate limits, or data scoping by itself.
- **API to PostgreSQL** — the API has broad read/write access to business data. Any missing server-side authorization or injection flaw at the route layer can expose or corrupt the full dataset.
- **API to external services** — the server can call OpenAI, SMTP, Twilio, and Expo push services with privileged credentials. Public endpoints that trigger these calls can create data leakage, spam, or financial abuse.
- **Public vs authenticated vs admin boundaries** — the codebase distinguishes employee sessions from admin PIN access in some flows, but those boundaries must be enforced on the server for every sensitive route.
- **Prod vs dev-only boundary** — `artifacts/mockup-sandbox`, build scripts, and local tooling are normally out of scope unless reachable from the deployed application.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/index.ts`, `artifacts/mobile/app/_layout.tsx`, `artifacts/mobile/contexts/CurrentUserContext.tsx`
- **Highest-risk areas:** `artifacts/api-server/src/routes/*.ts`, especially `auth.ts`, `inventory.ts`, `stores.ts`, `chemicals.ts`, `orders.ts`, `received.ts`, `alerts.ts`, `notifications.ts`, `reportbot.ts`, `scan.ts`, and `export.ts`
- **Public/authenticated/admin surfaces:** `/api/auth/*` for employee login/session checks, `x-user-token` as employee session header, `x-admin-pin` as admin control header, and all inventory/report/notification routes that should be scoped server-side
- **Confirmed public abuse surfaces:** `/api/inventory/scan`, `/api/push-tokens`, `/api/notifications/contacts`, `/api/admin/auth`, and any admin-header route that can be probed directly from the internet
- **Usually dev-only:** `artifacts/mockup-sandbox/**`, `artifacts/mobile/scripts/**`, and other local build helpers unless production exposure is proven

## Threat Categories

### Spoofing

The application uses employee PIN login and a separate admin PIN boundary. The API must treat all client-supplied identity claims, including `userId`, `storeId`, `role`, `x-user-token`, and `x-admin-pin`, as untrusted until verified server-side. Employee sessions must be validated on every protected route, and admin functionality must not rely on guessable or default credentials.

### Tampering

Inventory counts, alerts, stores, chemicals, deliveries, orders, pulls, and notification contacts are all business-critical records. The server must enforce that only authorized actors can create, update, acknowledge, or delete these records, and that store/role scope is checked on the backend rather than inferred from frontend screens.

### Information Disclosure

The API exposes operational history, contact data, and reporting surfaces that are valuable to competitors or malicious actors. Responses must be restricted to authenticated, authorized callers and scoped to the correct store or admin role. Error responses and logs must avoid leaking secrets or unnecessary internal detail.

### Denial of Service

Publicly reachable endpoints can trigger database work, CSV export generation, AI OCR, PDF generation, outbound notifications, and push-device registration. The application must ensure that expensive or cost-bearing operations are authenticated, rate-limited where appropriate, and not callable anonymously at internet scale. Admin-auth verification endpoints also need abuse controls because a bare success/failure oracle around a shared PIN is enough to enable brute-force takeover.

### Elevation of Privilege

The main privilege boundaries are anonymous → employee and employee → admin. The server must enforce those boundaries on every route, not just in the mobile UI. Administrative actions must require strong server-side authorization, and employee users must not be able to access or mutate data for other stores unless explicitly permitted.
