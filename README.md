# AP Food + FIF AI

<div align="center">
  <img src="public/brand/apfoods-wordmark-v1.png" alt="AP Food Logo" width="320" />
  <br /><br />
  <p><strong>Next-Generation Campus Food-Court Platform & Autonomous Intelligence Suite</strong></p>
  <p>
    Built with <strong>Next.js</strong>, <strong>Capacitor 8</strong>, <strong>Supabase</strong>, and <strong>Google Gemini</strong>.
  </p>

  <p>
    <a href="https://github.com/cloudywalnut/APFood/releases/tag/v1.0.0">
      <img src="https://img.shields.io/badge/Release-v1.0.0--Android-3b2a1e?style=for-the-badge&logo=android&logoColor=white" alt="Android APK Release" />
    </a>
    &nbsp;
    <a href="https://apfoods.vercel.app">
      <img src="https://img.shields.io/badge/Live_App-apfoods.vercel.app-b68b21?style=for-the-badge&logo=vercel&logoColor=white" alt="Live App" />
    </a>
    &nbsp;
    <img src="https://img.shields.io/badge/Tests-113_Passed-2e7d32?style=for-the-badge" alt="Tests Passed" />
  </p>
</div>

---

## 🌟 Executive Summary

**AP Food** is an enterprise-grade campus dining and kitchen operations ecosystem engineered for Asia Pacific University (APU). It solves the physical food-court bottleneck — peak lecture rushes, chaotic queues, and cash transaction latency — through a unified architecture combining:

1. **A Native Android Mobile App (Student Edition)**: A standalone, student-exclusive mobile application built with Capacitor 8 for rapid menu discovery, multi-counter basket checkout, scheduled pickups, and conversational AI assistance.
2. **A Multi-Portal Desktop Web Platform**: High-density operational dashboards for **Food-Stall Vendors** (kitchen dispatch bump bars, live capacity tuning, and inventory analytics) and **Cafeteria Administrators** (financial audits, rush forecasting, and campus oversight).
3. **FIF AI (Food Intelligence Framework)**: A deterministic, dual-engine AI framework operating across students, vendors, and management.

---

## 📱 Standalone Android App (Student Experience)

The mobile application is compiled as a standalone Android APK and dedicated exclusively to the student journey. Non-student accounts are automatically gated to the desktop web portal to keep the mobile experience lightweight, distraction-free, and blazing fast.

<div align="center">
  <p><strong>The Complete Student Mobile Flow</strong></p>
  <table border="0">
    <tr>
      <td align="center" width="33%">
        <img src="docs/screenshots/mobile-login.png" width="100%" alt="Student Login" />
        <br />
        <sub><b>1. Branded Authentication</b><br />Student session & cookie persistence</sub>
      </td>
      <td align="center" width="33%">
        <img src="docs/screenshots/mobile-marketplace.png" width="100%" alt="Discover & Deals" />
        <br />
        <sub><b>2. Campus Marketplace</b><br />Cross-counter ordering & meal deals</sub>
      </td>
      <td align="center" width="33%">
        <img src="docs/screenshots/mobile-fif-ai.png" width="100%" alt="FIF AI Assistant" />
        <br />
        <sub><b>3. FIF AI Campus Concierge</b><br />Live order tracking & budget recommendations</sub>
      </td>
    </tr>
  </table>
</div>

### Key Student Capabilities

- **Multi-Stall Cart**: Pool chicken noodle bowls from the Chinese stall and iced kopi from the Malay counter into a single atomic transaction.
- **Scheduled Break Pickups**: Choose precise pickup time windows matched to lecture schedules to bypass counter lines completely.
- **Visual Order Progression**: 4-stage tracking (_Placed &rarr; Accepted &rarr; Preparing &rarr; Ready_) with cryptographic 8-digit pickup codes and QR verification.

---

## 💻 Web Multi-Portal Ecosystem

The web platform powers the administrative and commercial engine of the campus cafeteria. Optimized for high-throughput desktop displays.

### 1. Student Web Marketplace

Full-width storefront with interactive filtering, cuisine categories, dietary tags, and live stall opening hours.

<div align="center">
  <img src="docs/screenshots/web-marketplace.png" width="100%" alt="Student Web Marketplace" />
</div>

---

### 2. Vendor Kitchen Board & Operations Centre

High-density kitchen workstation built for stall operators. Features live bump bar dispatch, active order streams, preparation timing calibration, and revenue metrics.

<div align="center">
  <img src="docs/screenshots/web-vendor-dashboard.png" width="100%" alt="Vendor Kitchen Board" />
</div>

---

### 3. Cafeteria Administrator Command Centre

Executive oversight dashboard for cafeteria directors. Reconciles multi-stall ledger transactions, tracks collections, maps food-court foot-traffic patterns, and audits tenant performance.

<div align="center">
  <img src="docs/screenshots/web-admin-command.png" width="100%" alt="Admin Command Centre" />
</div>

---

## 🧠 FIF AI: Deep-Dive Architecture

The **Food Intelligence Framework (FIF)** is an autonomous, multi-tier artificial intelligence system custom-built for high-volume campus operations. Rather than relying on simple chat prompts, FIF operates as a **strictly bound, deterministic agent** powered by **Google Gemini** (with seamless **OpenAI** failover), executing strictly verified read-only tools and signed mutation proposals.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FIF AI CORE ENGINE                                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│   STUDENT CHAT   │             │  VENDOR COPILOT  │             │ ADMIN STRATEGIC  │
│    CONCIERGE     │             │    INTELLIGENCE  │             │   DECISION DESK  │
└──────────────────┘             └──────────────────┘             └──────────────────┘
         │                                 │                                 │
         │  • Order Status Inquiries       │  • Rush Prep Recommendations    │  • Cashflow Reconcile
         │  • Budget Deals Discovery       │  • Dynamic Margin Tuning        │  • Foot-Traffic Model
         │  • Menu Recommendations         │  • Low-Stock Safeguards         │  • Tenant Benchmark
         │  • Signed Cart Additions        │  • KL Weather Correlation       │  • Audit PDF / CSV
         │                                 │                                 │
         └─────────────────────────────────┼─────────────────────────────────┘
                                           │
                                           ▼
             ┌───────────────────────────────────────────────────────────┐
             │            HYBRID RUNTIME & FAILOVER CONTROLLER           │
             │           lib/backend/fif-chat-runtime.ts                 │
             └───────────────────────────────────────────────────────────┘
                                           │
                       ┌───────────────────┴───────────────────┐
                       ▼                                       ▼
             ┌───────────────────┐                   ┌───────────────────┐
             │   PRIMARY MODEL   │                   │  FAILOVER MODEL   │
             │   Google Gemini   │  ──[Timeout/429]─►│      OpenAI       │
             │ 2.5 Flash / Pro   │                   │  GPT-4o / Luna    │
             └───────────────────┘                   └───────────────────┘
                                           │
                                           ▼
             ┌───────────────────────────────────────────────────────────┐
             │              DETERMINISTIC GUARDRAIL LAYER                │
             │   • Strict Zod Schema Contracts                           │
             │   • Row-Level Security (RLS) Isolation                    │
             │   • Ephemeral Signed Proposal Tokens (No Direct DB Write) │
             │   • Atomic Stored Procedure Execution (Postgres RPC)      │
             └───────────────────────────────────────────────────────────┘
```

### 1. Dual-Model Runtime & Sub-Second Failover

FIF implements a distributed provider architecture (`lib/backend/fif-chat-runtime.ts`):

- **Primary Engine**: Google Gemini Interactions API (`gemini-2.5-flash`), delivering near-instant latency (<800ms) for real-time mobile responses.
- **Automated Fallback**: If Gemini encounters rate limits (HTTP 429), regional outages, or a 10s deadline timeout, the orchestrator automatically replays the conversation and active tool observations through OpenAI (`gpt-4o`) without interrupting the user session.
- **Zero-Hallucination Fallback**: If both providers fail or are disconnected, deterministic offline heuristic engines take over, providing accurate answers for greetings, order summaries, and stall navigation without fabricating facts.

### 2. Autonomous Tool Calling with Zod Schemas

Every action FIF undertakes runs through typed, strongly validated tools (`lib/backend/student-fif-chat.ts` and `lib/backend/fif-agent.ts`):

- `check_my_orders`: Owner-scoped inspection of live order statuses, estimated prep times, and ready alerts.
- `search_dishes`: Real-time semantic menu lookup respecting cuisine, budget bounds, and current counter availability.
- `find_campus_deals`: Scans active discounted promotions across all 10 campus counters.
- `estimate_pickup_window`: Analyzes active counter queue density to estimate pickup windows for incoming orders.

### 3. Cryptographically Signed Cart Actions

To prevent rogue model hallucinations from mutating customer data, FIF **never writes directly to the database**:

1. When a student says _"Add the spicy noodles to my cart"_, FIF inspects availability and issues a signed, ephemeral `StudentCartAction` proposal token.
2. The proposal token embeds an expiration timestamp, item ID, portion options, and the exact verified unit price.
3. The UI renders an interactive **"Add to Cart"** button or awaits explicit student confirmation.
4. The client signs the token through an authenticated atomic Postgres RPC (`confirm_fif_cart`), updating the user's persistent cart while verifying stock constraints.

### 4. Telemetry-Driven Vendor Copilot

For stall operators, FIF continuously analyzes 7 real-time operational signals:

- **Order Surge Velocity**: Flags when orders-per-minute exceed counter preparation capacity.
- **Stock Depletion Velocity**: Warns vendors before an ingredient runs out and calculates replenishment targets.
- **Weather-Correlated Demand**: Integrates real-time Kuala Lumpur weather telemetry (thunderstorms vs heat) to forecast campus foot traffic.
- **Dynamic Merchandising Suggestions**: Projects gross revenue uplifts, portion changes, and prep workload deltas with bounded evidence snapshots.

---

## 🔑 Demo Credentials

All test accounts share the unified password: **`APFoods123!`**

> [!IMPORTANT]
> The **Android Mobile App** is dedicated exclusively to the student experience (`student@apfoods.local`). Vendor and Administrator workspaces are optimized for desktop displays and should be accessed via a web browser.

| Role              | Email                    | Password      | Access Channel          | Description                                          |
| :---------------- | :----------------------- | :------------ | :---------------------- | :--------------------------------------------------- |
| **Student**       | `student@apfoods.local`  | `APFoods123!` | **Mobile App** & Web    | Full ordering flow, Multi-stall cart, FIF AI chat    |
| **Chinese Stall** | `chinese@apfoods.local`  | `APFoods123!` | Web Browser (`/vendor`) | Campus Noodle Bar: Bump bar, menu stock & Copilot    |
| **Malay Stall**   | `malay@apfoods.local`    | `APFoods123!` | Web Browser (`/vendor`) | Brew & Bites: Drinks, breakfast & hot meals          |
| **Japan & Korea** | `japanese@apfoods.local` | `APFoods123!` | Web Browser (`/vendor`) | Green Bowl Kitchen: Bento, bowls & stock control     |
| **Indian Stall**  | `indian@apfoods.local`   | `APFoods123!` | Web Browser (`/vendor`) | Indian Counter: Curries, breads & order queue        |
| **Arab Shawarma** | `shawarma@apfoods.local` | `APFoods123!` | Web Browser (`/vendor`) | Shawarma Station: Live wrap preparation queue        |
| **Administrator** | `admin@apfoods.local`    | `APFoods123!` | Web Browser (`/admin`)  | Cafeteria Command Centre: Cashflow, audits & traffic |

---

## 🚀 Installation & Setup Guide

### Option 1: Running the Web Application Locally

#### Prerequisites

- **Node.js**: `v22.0.0` or higher
- **npm**: `v10.0.0` or higher

```bash
# 1. Clone the repository
git clone https://github.com/cloudywalnut/APFood.git
cd APFood

# 2. Install dependencies
npm ci

# 3. Create local environment configuration
cp .env.example .env.local
# On Windows PowerShell: Copy-Item .env.example .env.local

# 4. Fill in your credentials in .env.local:
# NEXT_PUBLIC_SUPABASE_URL="https://<your-project>.supabase.co"
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<your-publishable-key>"
# SUPABASE_SECRET_KEY="<your-secret-key>"
# GEMINI_API_KEY="<your-gemini-key>"

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Option 2: Installing the Standalone Android Mobile App

#### Pre-Built APK

You can download the pre-built APK directly from our releases:
👉 **[Download APFood-student-v1.0.0.apk](https://github.com/cloudywalnut/APFood/releases/download/v1.0.0/APFood-student-v1.0.0.apk)**

#### Building the APK from Source

**Requirements:**

- Android Studio (Koala / Ladybug or newer)
- Android SDK 34 / 35 & Command-Line Tools
- Java JDK 17 or JDK 21

```bash
# 1. Navigate to the android directory
cd android

# 2. Build the Debug APK using Gradle
./gradlew assembleDebug
# On Windows PowerShell: .\gradlew.bat assembleDebug

# 3. Output binary location:
# android/app/build/outputs/apk/debug/app-debug.apk

# 4. Install onto a connected Android device or emulator:
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n my.conceptsquad.apfood/.MainActivity
```

---

## 🧪 Verification & Quality Suite

The codebase enforces strict test-driven development:

| Command                | Target        | Coverage                                                                    |
| :--------------------- | :------------ | :-------------------------------------------------------------------------- |
| `npm run typecheck`    | TypeScript    | Strict zero-any type validation & route type generation                     |
| `npm test`             | Unit Tests    | **83 tests**: Order state machine, revenue models, FIF agent logic          |
| `npm run test:backend` | Embedded DB   | **30 tests**: Real SQL migrations in in-memory Postgres, RLS policies, RPCs |
| `npm run build`        | Next.js Build | Full static generation and server-side route compilation                    |
| `npm run format:check` | Prettier      | Architectural formatting & style adherence                                  |

---

<div align="center">
  <sub>Built with ❤️ for Asia Pacific University campus dining.</sub>
</div>
