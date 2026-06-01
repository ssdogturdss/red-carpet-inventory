# Architecture

Red Carpet Inventory is a **pnpm monorepo** running a React Native (Expo) mobile app backed by an Express 5 API server and a PostgreSQL database. This document covers the system topology, data model, request flow, and package dependency graph.

---

## System Overview

```mermaid
graph TD
    subgraph Devices
        A[📱 iOS / Android\nExpo Go]
        B[🌐 Browser\nPWA]
    end

    subgraph Replit ["Replit (shared proxy → path routing)"]
        subgraph mobile ["artifacts/mobile  (Expo Metro · :18115)"]
            M[React Native Web\nExpo Router v6]
        end

        subgraph api ["artifacts/api-server  (Express 5 · :8080)"]
            R[Route handlers\n/api/*]
            SVC[Services\npush · scan · poller]
        end

        subgraph DB ["PostgreSQL"]
            PG[(Drizzle ORM)]
        end
    end

    subgraph External
        EXPO_PUSH[Expo Push\nAPI]
        OPENAI[OpenAI GPT-5.4\nVision / OCR]
        SMTP[SMTP\nEmail alerts]
        TWILIO[Twilio\nSMS alerts]
    end

    A -->|exp:// QR scan| mobile
    B -->|HTTPS /| mobile
    mobile -->|HTTPS /api/*| api
    R --> SVC
    R --> PG
    SVC --> EXPO_PUSH
    SVC --> OPENAI
    SVC --> SMTP
    SVC --> TWILIO
```

---

## Monorepo Package Graph

```mermaid
graph LR
    subgraph artifacts
        MOBILE[mobile\nExpo app]
        API[api-server\nExpress 5]
    end

    subgraph lib
        DB[db\nDrizzle schema]
        SPEC[api-spec\nOpenAPI YAML]
        REACT_CLIENT[api-client-react\nReact Query hooks]
        ZOD[api-zod\nZod schemas]
        INTEGRATIONS[integrations\nConnectors SDK]
    end

    SPEC -->|orval codegen| REACT_CLIENT
    SPEC -->|orval codegen| ZOD

    MOBILE --> REACT_CLIENT
    MOBILE --> ZOD

    API --> DB
    API --> ZOD
    API --> INTEGRATIONS
```

---

## API Route Map

```mermaid
graph LR
    subgraph Public ["/api — public"]
        HLT[GET /healthz]
        AUTH_U[GET /auth/users]
        AUTH_L[POST /auth/login]
        AUTH_ME[GET /auth/me]
        AUTH_LO[POST /auth/logout]
        STORES[GET /stores]
        CHEMS[GET /chemicals]
    end

    subgraph Authenticated ["/api — user token required"]
        INV[POST /inventory/submit\nGET /inventory/history\nGET /inventory/week]
        SCAN[POST /scan]
        ALERTS[GET /alerts]
        ORDERS[GET·POST /orders\nPATCH /orders/:id]
        RCVD[GET·POST /received]
        ONHAND[GET /onhand]
        PULLS[GET·POST /chemical-pulls]
        EXPORT[GET /export/csv]
        PUSH_TOK[POST /push-tokens\nDELETE /push-tokens/:id]
        NOTIF[GET /notifications]
        REPORTS[GET /reports/*]
    end

    subgraph Admin ["/api/admin — admin PIN required"]
        ADM_ALERTS[GET·PATCH·DELETE /admin/alerts]
        ADM_STORES[GET·POST·PATCH·DELETE /admin/stores]
        ADM_CHEMS[GET·POST·PATCH·DELETE /admin/chemicals]
        ADM_COUNTS[GET·DELETE /admin/counts]
        ADM_USERS[GET·POST·PATCH·DELETE /admin/users]
        ADM_TOKENS[GET·DELETE /admin/push-tokens]
        ADM_RECEIPTS[GET /admin/push-receipts]
        ADM_BOT[GET·PATCH /admin/bot-settings]
    end
```

---

## Database Schema (ER Diagram)

```mermaid
erDiagram
    stores {
        int id PK
        text name
        text storeNumber
    }

    chemicals {
        int id PK
        text name
        text unit
        int thresholdPercent
    }

    users {
        int id PK
        text name
        int storeId FK
        text pinHash
        text role
        text token
    }

    inventory_counts {
        int id PK
        int storeId FK
        int userId FK
        date weekOf
        timestamp submittedAt
    }

    inventory_entries {
        int id PK
        int countId FK
        int chemicalId FK
        numeric quantity
    }

    alerts {
        int id PK
        int storeId FK
        int chemicalId FK
        int countId FK
        text severity
        text direction
        numeric pctChange
        boolean acknowledged
        timestamp createdAt
    }

    push_tokens {
        int id PK
        text token
        text platform
        int userId FK
        timestamp createdAt
    }

    push_receipts {
        int id PK
        text ticketId
        text token
        int alertId FK
        text storeName
        text chemicalName
        text severity
        text status
        text errorCode
        timestamp sentAt
        timestamp checkedAt
    }

    chemical_orders {
        int id PK
        int storeId FK
        int chemicalId FK
        numeric quantity
        text unit
        text status
        date orderDate
        text notes
    }

    inventory_received {
        int id PK
        int storeId FK
        int chemicalId FK
        int orderId FK
        numeric quantity
        date receivedDate
        text poNumber
        text receivedBy
    }

    chemical_pulls {
        int id PK
        int storeId FK
        int chemicalId FK
        numeric quantity
        date pullDate
        text pulledBy
        text notes
    }

    stores ||--o{ users : "employs"
    stores ||--o{ inventory_counts : "has"
    stores ||--o{ alerts : "triggers"
    stores ||--o{ chemical_orders : "places"
    stores ||--o{ inventory_received : "receives"
    stores ||--o{ chemical_pulls : "pulls"
    chemicals ||--o{ inventory_entries : "tracked in"
    chemicals ||--o{ alerts : "triggers"
    chemicals ||--o{ chemical_orders : "ordered as"
    chemicals ||--o{ inventory_received : "received as"
    chemicals ||--o{ chemical_pulls : "pulled as"
    inventory_counts ||--o{ inventory_entries : "contains"
    inventory_counts ||--o{ alerts : "generates"
    users ||--o{ inventory_counts : "submits"
    alerts ||--o{ push_receipts : "notifies via"
```

---

## Weekly Count Submission Flow

```mermaid
sequenceDiagram
    actor Employee
    participant App as Expo App
    participant API as API Server
    participant DB as PostgreSQL
    participant Push as Expo Push API

    Employee->>App: Fill 23 chemical quantities\n(or scan paper sheet → OCR)
    App->>API: POST /api/inventory/submit
    API->>DB: INSERT inventory_counts + inventory_entries
    API->>DB: SELECT previous week's counts
    API->>API: Compare Δ% per chemical\nagainst thresholdPercent
    alt |Δ%| ≥ threshold
        API->>DB: INSERT alert (warning / critical)
        API->>DB: SELECT push_tokens for store
        API-->>Push: POST /push/send (non-blocking)
        Push-->>App: Push notification
        Note over API: pushReceiptPoller checks\ndelivery status every 15 min
    end
    API-->>App: 201 Created
    App-->>Employee: "Submission saved ✓"
```

---

## Push Notification Delivery Pipeline

```mermaid
sequenceDiagram
    participant API as API Server
    participant Expo as Expo Push API
    participant DB as PostgreSQL

    API->>Expo: POST /push/send → ticket IDs
    API->>DB: INSERT push_receipts (status=pending)
    Note over API: 15-minute interval
    loop pushReceiptPoller (every 15 min)
        API->>DB: SELECT push_receipts WHERE status=pending\nAND sentAt > 30s ago
        API->>Expo: POST /push/getReceipts
        Expo-->>API: receipt statuses
        API->>DB: UPDATE push_receipts (ok / error)
        alt status=error AND DeviceNotRegistered
            API->>DB: DELETE push_token
        end
    end
```

---

## Authentication Flow

```mermaid
flowchart TD
    A[Open app] --> B{Stored token?}
    B -- No --> C[Login screen\nfetch /auth/users]
    B -- Yes --> D[GET /auth/me]
    D -- 401 --> C
    D -- 200 --> E[App tabs]
    C --> F[Select employee]
    F --> G[Enter 4-digit PIN]
    G --> H[POST /auth/login]
    H -- success --> I[Store token\nin SecureStore / localStorage]
    I --> E
    H -- fail --> J[Show error\nmax 5 attempts / 15 min lockout]
    J --> G
    E --> K[Admin access link]
    K --> L[Enter admin PIN]
    L -- match ADMIN_PIN env --> E
```
