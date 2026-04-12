# Testament

> **Trustless crypto inheritance on Solana. Your assets stay in your wallet — until you stop checking in.**

Testament is a dead man's switch protocol built on Solana. You designate beneficiaries, set a check-in schedule, and designate which tokens they inherit. As long as you click one link periodically, nothing happens. Stop checking in — and a countdown starts automatically. When it ends, every transfer executes automatically. Your beneficiaries don't need to visit a website, click anything, or even know Testament exists. The tokens just arrive in their wallets.

Built for the [Colosseum Frontier Hackathon](https://colosseum.com/frontier) · April 2026.

---

## The Problem

**$150 billion in crypto is permanently lost every year** — not to hacks, but to death. When someone dies without sharing their seed phrase, the assets are gone. No court order or family member can recover self-custodied crypto.

Existing solutions all fail in the same fundamental ways:

- **Centralised exchanges** require death certificates, probate, and KYC — and can freeze or deny access
- **Crypto will services** require your beneficiary to know what a blockchain is and go through a claims process
- **Other on-chain inheritance protocols** either lock your funds in a vault (you lose access to spend) or require beneficiaries to manually "claim" on a website

---

## The Key Insight

Every competitor solved the wrong problem. They asked *"how do we let someone claim crypto after death?"*

Testament asks *"how do we make assets transfer without anyone doing anything?"*

That single insight drives the entire architecture:

- Tokens **stay in your wallet** — you can spend them freely at any time
- No deposit, no lockup, no custody transfer
- The keeper bot executes transfers automatically — beneficiaries never need to interact
- The on-chain program is permissionless — even if Testament the company disappears, the protocol keeps working

---

## How It Works

### The full flow

```
SETUP (one time, ~5 minutes)
  1. Connect wallet → create vault (set check-in interval + countdown duration)
  2. Add beneficiaries with wallet addresses and % splits (must total 100%)
  3. Lock vault (no more changes to beneficiaries after this)
  4. Designate SOL → enters SolDelegation PDA (held in escrow, revocable anytime)
  5. Designate SPL tokens (USDC, etc.) → spl_token::approve sets program as delegate
     — tokens never leave your wallet, approval is revocable anytime

LIVING (recurring)
  6. Every N days, click your check-in link (email or QR code from dashboard)
     One click, one transaction, costs ~$0.000005. Takes 2 seconds.

IF YOU MISS A CHECK-IN (automatic, no one triggers it)
  7. Keeper bot detects missed check-in → calls trigger_countdown()
  8. Owner receives email: "missed check-in alert started"
  9. You have a configurable dispute window (default: half the countdown) to cancel
     by clicking "I'm still alive" on the dashboard

IF YOU CANCEL (still alive)
  10. dispute() resets the vault — everything returns to normal

IF COUNTDOWN COMPLETES (automatic)
  11. Keeper bot calls execute_sol_inheritance() for each beneficiary (SOL transfers)
  12. Keeper bot calls execute_inheritance() for each SPL token delegation
  13. Owner receives email: transfers have executed
  14. SOL and tokens arrive directly in beneficiaries' wallets
  — nobody needs to do anything
```

### The conditional delegation model

This is what makes Testament different from every other protocol:

**SPL tokens (USDC, etc.):**
- `spl_token::approve` is called with the `DelegationRecord` PDA as the delegate
- Tokens remain in your wallet — you can spend them, trade them
- The program can only transfer them when `countdownStartedAt + countdownDuration <= now`
- You can revoke the approval anytime via `revoke_delegation`

**Native SOL:**
- SOL cannot be SPL-delegated, so designated SOL moves into a `SolDelegation` PDA
- The PDA holds the lamports. You can revoke anytime via `revoke_sol_delegation` (PDA closes, lamports return)
- The keeper executes transfers proportionally based on each beneficiary's share in basis points

---

## Architecture

### On-chain Program (Anchor 0.32.1)

**Program ID (devnet):** `2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc`

#### Account types

| Account | PDA Seeds | Size | Description |
|---|---|---|---|
| `Vault` | `["vault", owner]` | 185 bytes | Core state: owner, intervals, timestamps, flags, recovery fields |
| `Beneficiary` | `["beneficiary", vault, wallet]` | 77 bytes | One per beneficiary: wallet, share_bps, index, has_claimed |
| `SolDelegation` | `["sol_delegation", vault]` | 51 bytes | Holds designated native SOL; claimed_mask bitmask |
| `DelegationRecord` | `["delegation", vault, mint]` | 115 bytes | One per SPL token: mint, owner_ata, approved_amount, claimed_mask |
| `GuardianConfig` | `["guardian_config", vault]` | 235 bytes | Up to 3 guardian wallets, pending votes, quorum state |

#### All instructions

**Core vault lifecycle:**

| Instruction | Signer | Description |
|---|---|---|
| `create_vault` | Owner | Initialize vault with heartbeat_interval, countdown_duration, dispute_window, message_hash |
| `add_beneficiary` | Owner | Add beneficiary wallet + share_bps. Vault must be unlocked. Max 10. |
| `lock_vault` | Owner | Lock vault — total_shares_bps must equal 10,000. No beneficiary changes after. |
| `close_vault` | Owner | Close vault, reclaim rent. Only when no countdown is active. |

**Check-in and countdown:**

| Instruction | Signer | Description |
|---|---|---|
| `heartbeat` | Owner | Proof of life. Resets last_heartbeat. If countdown active and within dispute_window, cancels countdown. |
| `trigger_countdown` | Anyone | Permissionless. Sets countdown_started_at = now. Only callable after heartbeat interval elapses. |
| `dispute` | Owner | Explicitly cancel an active countdown. Resets countdown_started_at to 0. |

**SOL inheritance:**

| Instruction | Signer | Description |
|---|---|---|
| `register_sol_delegation` | Owner | Transfer SOL from owner wallet into SolDelegation PDA. Revocable. |
| `revoke_sol_delegation` | Owner | Close SolDelegation PDA, return all lamports to owner. |
| `execute_sol_inheritance` | Anyone (keeper) | Transfer each beneficiary's lamport share from PDA to their wallet. Permissionless — keeper calls this. |

**SPL token inheritance:**

| Instruction | Signer | Description |
|---|---|---|
| `register_delegation` | Owner | Calls spl_token::approve — sets DelegationRecord PDA as delegate on owner's ATA. Tokens stay in wallet. |
| `revoke_delegation` | Owner | Calls spl_token::revoke, closes DelegationRecord PDA. |
| `execute_inheritance` | Anyone (keeper) | Transfers token share from owner's ATA to beneficiary's ATA (created if needed). Permissionless. |

**Guardians (social recovery):**

| Instruction | Signer | Description |
|---|---|---|
| `add_guardian` | Owner | Register a guardian wallet (max 3). Cannot add during active countdown. |
| `guardian_heartbeat` | Guardian | Cast a "they're alive" vote. When 2-of-3 vote, resets countdown and clears vote round. |

**Wallet recovery:**

| Instruction | Signer | Description |
|---|---|---|
| `register_recovery_wallet` | Owner | Pre-register a backup wallet for ownership transfer. |
| `register_passkey` | Owner | Store compressed P-256 public key for biometric liveness proofs. |
| `transfer_ownership` | Owner + Recovery wallet | Transfer vault ownership to a new wallet. |
| `recover_with_passkey` | Recovery wallet | Passkey-based ownership recovery. |

---

### Frontend (Next.js 15, App Router)

#### Pages

| Route | Who uses it | What it does |
|---|---|---|
| `/` | Anyone | Landing page with hero, how-it-works, live protocol stats (vault count, SOL protected), wallet balance calculator |
| `/create` | Owner (new) | 5-step wizard: (1) check-in schedule → (2) add beneficiaries → (3) review + create → (4) designate SOL → (5) success |
| `/dashboard` | Owner | Full vault management: check-in status, live countdown timer, designate SOL/SPL, guardians, final message, QR code |
| `/recover` | Owner (lost wallet) | Wallet recovery flow — register recovery wallet, initiate transfer with guardian consensus |

#### API Routes

| Route | Method | Called by | Purpose |
|---|---|---|---|
| `/api/keeper` | POST | Manual / scripts | Run keeper manually. Protected by `x-keeper-secret` header |
| `/api/keeper` | GET | Vercel cron (every 5 min) | Automated keeper run. Protected by `Authorization: Bearer <CRON_SECRET>` |
| `/api/stats` | GET | Home page | Returns `{ totalVaults, totalSolProtected }` fetched live from devnet. 60s cache. |
| `/api/actions/heartbeat` | GET/POST | Wallet / Blink | Solana Action — builds heartbeat transaction for owner |
| `/api/actions/claim` | GET/POST | Wallet / Blink | Solana Action — builds execute_sol_inheritance transaction |
| `/api/actions/trigger` | GET/POST | Wallet / Blink | Solana Action — builds trigger_countdown transaction |
| `/api/notify/welcome` | POST | Create flow | Sends welcome email with heartbeat link. Also registers vault→email in registry. |
| `/api/notify/reminder` | POST | Keeper bot | Sends overdue / countdown_started / countdown_urgent emails to owner |
| `/api/notify/inheritance` | POST | Keeper bot | Sends "transfer executed" email to owner after inheritance runs |

#### Key libraries and hooks

| File | Purpose |
|---|---|
| `app/hooks/useVault.ts` | Reads vault + all beneficiary PDAs from chain. Used by dashboard. |
| `app/lib/program.ts` | PDA derivation helpers: `vaultPda`, `beneficiaryPda`, `solDelegationPda`, `delegationRecordPda` |
| `app/lib/idl.json` | Generated IDL — copied from `target/idl/testament.json` after `anchor build` |
| `app/lib/testament.ts` | TypeScript types for the program — copied from `target/types/testament.ts` |
| `app/lib/emailRegistry.ts` | Vault → owner email mapping. Persists to `.data/emails.json` locally. Falls back to in-memory on Vercel. |

---

### Keeper Bot

The keeper is the engine that makes everything automatic. It runs as a Next.js API route called by Vercel cron every 5 minutes.

**What it does each run:**

```
1. getProgramAccounts(PROGRAM_ID, { filters: [{ dataSize: VAULT_LEN }] })
   → fetch every vault on-chain

2. For each vault that is active + locked:

   a. IF heartbeat_interval elapsed AND no countdown active:
      → trigger_countdown()
      → email owner: "missed check-in alert has started"

   b. IF countdown complete (now >= countdown_started_at + countdown_duration):

      → fetch all Beneficiary accounts for this vault
      → fetch SolDelegation PDA (if exists)
         → for each beneficiary not yet in claimed_mask:
            execute_sol_inheritance() → SOL lands in beneficiary wallet
            → email owner: "X SOL transferred to beneficiary"

      → fetch all DelegationRecord accounts for this vault
         → for each (delegation_record, beneficiary) pair not in claimed_mask:
            execute_inheritance() → SPL tokens land in beneficiary ATA
            → (keeper pays ATA creation fee if needed)
```

**Key design decisions:**

- **Permissionless execution** — `execute_sol_inheritance` and `execute_inheritance` can be called by anyone. The keeper pays the transaction fee but the program verifies everything on-chain.
- **Idempotent** — `claimed_mask` bitmask prevents double-execution. Errors for `AlreadyClaimed` and `CountdownAlreadyStarted` are silently ignored.
- **Fire-and-forget emails** — email failures never block or crash keeper execution.
- **Inline wallet adapter** — `@coral-xyz/anchor`'s `Wallet` class is CJS-only and breaks in Next.js ESM bundles. The keeper implements the wallet interface inline.

---

## Email Notifications

Testament sends three categories of emails via [Resend](https://resend.com):

| Trigger | Recipient | Subject |
|---|---|---|
| Vault created | Owner | "Your inheritance vault is live — save your heartbeat link" |
| Countdown starts (keeper) | Owner | "🚨 Countdown started on your Testament vault" |
| Transfers execute (keeper) | Owner | "Inheritance transfer executed — X SOL sent" |

Email → vault mapping is registered when the welcome email is sent (in `/api/notify/welcome`). The keeper looks up the owner's email via `lookupEmail(vaultAddress)` before sending.

---

## Project Structure

```
testament/
├── programs/testament/src/
│   ├── lib.rs                          # Program entrypoint — registers all instructions
│   ├── errors.rs                       # Custom error codes
│   ├── state/
│   │   ├── mod.rs
│   │   ├── vault.rs                    # Vault account (185 bytes) + constants
│   │   ├── beneficiary.rs              # Beneficiary account (77 bytes)
│   │   ├── delegation_record.rs        # SPL delegation record (115 bytes)
│   │   ├── sol_delegation.rs           # Native SOL delegation PDA (51 bytes)
│   │   └── guardian_config.rs          # Guardian config (235 bytes), quorum logic
│   └── instructions/
│       ├── create_vault.rs
│       ├── add_beneficiary.rs
│       ├── lock_vault.rs
│       ├── close_vault.rs
│       ├── heartbeat.rs
│       ├── trigger_countdown.rs
│       ├── dispute.rs
│       ├── register_sol_delegation.rs
│       ├── revoke_sol_delegation.rs
│       ├── execute_sol_inheritance.rs
│       ├── register_delegation.rs
│       ├── revoke_delegation.rs
│       ├── execute_inheritance.rs
│       ├── add_guardian.rs
│       ├── guardian_heartbeat.rs
│       ├── register_recovery_wallet.rs
│       ├── register_passkey.rs
│       ├── transfer_ownership.rs
│       └── recover_with_passkey.rs
├── tests/
│   └── testament.ts                    # Integration tests (solana-bankrun)
├── scripts/
│   ├── test-flow.ts                    # End-to-end CLI test script
│   └── run-keeper.sh                   # Local keeper runner (polls every 60s)
└── app/
    ├── app/
    │   ├── page.tsx                    # Landing page
    │   ├── create/page.tsx             # 5-step vault creation wizard
    │   ├── dashboard/page.tsx          # Owner dashboard
    │   ├── recover/page.tsx            # Wallet recovery flow
    │   └── api/
    │       ├── keeper/route.ts         # Keeper bot (POST + GET)
    │       ├── stats/route.ts          # Live protocol stats
    │       ├── actions/
    │       │   ├── heartbeat/route.ts  # Blink: owner check-in
    │       │   ├── claim/route.ts      # Blink: execute inheritance
    │       │   └── trigger/route.ts    # Blink: trigger countdown
    │       └── notify/
    │           ├── welcome/route.ts    # Email: vault created
    │           ├── reminder/route.ts   # Email: missed check-in alerts
    │           └── inheritance/route.ts # Email: transfer executed
    ├── components/
    │   └── Nav.tsx
    ├── hooks/
    │   └── useVault.ts
    └── lib/
        ├── program.ts                  # PDA helpers, PROGRAM_ID
        ├── idl.json                    # Generated IDL
        ├── testament.ts                # Generated TypeScript types
        └── emailRegistry.ts            # Vault → email persistence
```

---

## Local Development

### Prerequisites

- Rust with BPF toolchain (see `rust-toolchain.toml` — pinned to `1.79.0`)
- Solana CLI ≥ 2.3 — `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`
- Anchor CLI 0.32.1 — `avm install 0.32.1 && avm use 0.32.1`
- Node.js ≥ 18

### 1. Build the smart contract

```bash
anchor build
```

After building, the IDL and TypeScript types are in:
- `target/idl/testament.json`
- `target/types/testament.ts`

If you change the contract, copy these into the frontend:
```bash
cp target/idl/testament.json app/lib/idl.json
cp target/types/testament.ts app/lib/testament.ts
```

### 2. Run tests

```bash
# Uses solana-bankrun — no local validator needed, runs in ~300ms
anchor test --skip-local-validator
```

### 3. Deploy to devnet

```bash
solana config set --url devnet
anchor deploy --provider.cluster devnet
```

If the on-chain IDL is outdated (or the new IDL is larger than the old one):
```bash
# Close old IDL account, then re-upload
anchor idl close <PROGRAM_ID> --provider.cluster devnet
anchor idl init <PROGRAM_ID> --filepath target/idl/testament.json --provider.cluster devnet
```

### 4. Set up the frontend

```bash
cd app
npm install
cp .env.local.example .env.local   # then fill in your values
npm run dev
# → http://localhost:3000
```

### 5. Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_TESTAMENT_PROGRAM_ID` | Yes | Deployed program ID |
| `TESTAMENT_PROGRAM_ID` | Yes | Same — server-side usage |
| `NEXT_PUBLIC_SOLANA_RPC` | Yes | Solana RPC URL (devnet or mainnet-beta) |
| `SOLANA_RPC_URL` | Yes | Same — server-side usage |
| `NEXT_PUBLIC_APP_URL` | Yes | App base URL (e.g. `http://localhost:3000`) |
| `RESEND_API_KEY` | Yes (for emails) | Get from [resend.com](https://resend.com) — free tier works |
| `KEEPER_PRIVATE_KEY` | Yes | Funded wallet that pays keeper tx fees. JSON array or base58. |
| `KEEPER_SECRET` | Recommended | Secret to protect `POST /api/keeper` from abuse |
| `CRON_SECRET` | Vercel only | Set in Vercel dashboard — auto-injected into cron GET requests |
| `IRYS_PRIVATE_KEY` | Optional | For Arweave/IPFS final message storage (not yet wired) |

### 6. Run the keeper locally (background)

```bash
# In a separate terminal — polls every 60 seconds
bash scripts/run-keeper.sh
```

Or manually:
```bash
curl -X POST http://localhost:3000/api/keeper
```

---

## Testing the Full Flow (End-to-End)

```bash
# 1. Start the app
cd app && npm run dev

# 2. Run keeper in background (separate terminal)
bash scripts/run-keeper.sh

# 3. Create vault at http://localhost:3000/create
#    — Use 5-minute heartbeat interval, 10-minute countdown
#    — Add a test beneficiary wallet
#    — Designate 0.05 SOL on Step 4

# 4. Wait 5 minutes (heartbeat elapses)
#    → Keeper auto-triggers countdown
#    → You receive "countdown started" email

# 5. Wait 10 more minutes (countdown elapses)
#    → Keeper auto-executes transfers
#    → Beneficiary wallet receives SOL
#    → You receive "transfer executed" email

# 6. Verify beneficiary balance
solana balance <BENEFICIARY_WALLET> --url devnet

# Or use the test script (reads ~/.config/solana/id.json as owner)
npx ts-node scripts/test-flow.ts
```

---

## Vercel Deployment

```bash
cd app
npx vercel --prod
```

Add all environment variables in the Vercel dashboard (Settings → Environment Variables). The `vercel.json` cron config is already included:

```json
{
  "crons": [
    { "path": "/api/keeper", "schedule": "*/5 * * * *" }
  ]
}
```

Vercel runs `GET /api/keeper` every 5 minutes automatically on all deployed environments. No server to maintain.

**Important for production:**
- Set `KEEPER_SECRET` to a random string to prevent public keeper abuse
- Set `CRON_SECRET` in Vercel dashboard (matches the cron auth header)
- The email registry (`emailRegistry.ts`) uses in-memory storage on Vercel (read-only filesystem). For persistent email mappings across cold starts, replace with [Vercel KV](https://vercel.com/docs/storage/vercel-kv).

---

## Dashboard Features

The owner dashboard (`/dashboard`) provides:

- **Check-in status** — progress bar showing days until next deadline
- **Live countdown timer** — real-time `dd:hh:mm:ss` display when alert is active
- **QR code** — scan from phone to check in via Blink URL (no need to open laptop)
- **Designated assets** — shows SOL designation with revoke button; SPL token approval form with mint + amount
- **SPL delegations list** — all active token delegations by mint address
- **Guardians** — add up to 3 guardian wallets; status display; add form disabled during countdown
- **Recovery wallet** — link to set up backup wallet recovery
- **Final message** — write and save last words / account details locally; download as `.txt`
- **Transaction feedback** — green success toast after every action (5-second auto-dismiss)
- **Close plan** — danger zone; reclaims rent; disabled during active countdown

---

## Known Limitations (for teammate context)

These are known gaps, not bugs. Do not "fix" these without a plan:

1. **Email registry is not persistent on Vercel** — uses in-memory fallback. Fine for demo; needs Vercel KV for production.
2. **Final message is localStorage only** — not uploaded to Arweave/IPFS. `IRYS_PRIVATE_KEY` is in `.env.local` but unused.
3. **SPL token amounts assume 6 decimals** (USDC standard). Tokens with 9 decimals (native SOL-wrapped) will show wrong amounts.
4. **Guardian voting UI exists (add guardian) but the guardian themselves cannot vote from the dashboard** — `guardian_heartbeat` instruction is deployed but there is no guardian-facing page yet.
5. **Passkey / biometric check-in** — `register_passkey` and `recover_with_passkey` are deployed on-chain but the frontend has no UI for it yet. Shows "Soon" in dashboard.
6. **No mainnet deployment** — everything is on devnet. Mainnet requires a new `anchor deploy` and updated env vars.
7. **`KEEPER_SECRET` is empty** — the `POST /api/keeper` endpoint is publicly callable. Set this before any real usage.

---

## Competitive Landscape

| | Testament | Sarcophagus | Inheriti (SafeHaven) | Casa / Unchained | Centralised Exchange |
|---|---|---|---|---|---|
| **Chain** | Solana | EVM | Multi-chain | Bitcoin | Any |
| **Custody model** | No deposit — conditional delegation | Deposit | Deposit | Collaborative custody | Full custody |
| **Beneficiary action needed** | None — auto-transfer | Manual claim | Manual claim | Legal process | Legal process |
| **Asset types** | SOL + all SPL tokens | Files/secrets | SOL + SPL | Bitcoin only | Exchange assets only |
| **Multi-beneficiary** | Up to 10, % splits | No | Yes | No | No |
| **Check-in UX** | 1-click email / QR | Manual re-wrap | App | App | — |
| **Guardians** | Yes — 2-of-3 quorum | No | No | Yes (co-sign) | No |
| **Permissionless** | Yes — keeper is open-source | No | No | No | No |
| **Trust requirement** | Zero — on-chain only | Trust their server | Trust their server | Trust Casa | Trust exchange |

---

## Program ID

| Network | Program ID |
|---|---|
| Devnet | `2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc` |
| Mainnet | Not yet deployed |

---

*Testament · Colosseum Frontier Hackathon 2026 · Built on Solana*
