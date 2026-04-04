# Testament

> **Trustless on-chain crypto inheritance for Solana. Your assets, your rules — even after you're gone.**

Testament is a dead man's switch protocol that lets you designate beneficiaries with percentage splits, set a heartbeat interval, and leave an encrypted final message. As long as you check in via a single Blink click, nothing happens. Stop checking in — and your assets flow to your beneficiaries exactly as you intended. No lawyers, no seed phrases in envelopes, no trusted third parties.

Built for the [Colosseum Frontier Hackathon](https://colosseum.com/frontier) · April 6 – May 11, 2026.

---

## The Problem

$150 billion in cryptocurrency is permanently lost every year — not to hacks, but to death. When a holder dies without sharing their seed phrase, the assets are gone forever. No court order or family member can recover them.

Existing solutions are broken: wills become public record at probate, lawyers cost thousands per year and hold your keys, and the only Solana precedents are either single-beneficiary with no privacy or incomplete proofs-of-concept with no escrow.

---

## How It Works

```
1. SETUP      Create vault → add beneficiaries with % splits → deposit SOL →
              write encrypted final message → lock vault

2. LIVING     Click your heartbeat Blink once per interval (e.g. every 90 days).
              Costs ~0.000005 SOL. Takes 2 seconds.

3. MISSED     Anyone calls trigger_countdown() after the interval elapses.
              A configurable dispute window begins (default 14 days).

4. DISPUTE    Owner can still cancel activation during the dispute window
              by submitting a heartbeat transaction.

5. CLAIM      After the dispute window, each beneficiary claims their share
              via their own Blink URL. Amounts are private on-chain.
```

---

## Features

- **Multi-beneficiary % splits** — up to 10 beneficiaries, basis-point precision (1 bp = 0.01%), shares must total 100% before vault locks
- **One-click heartbeat via Blinks** — paste your heartbeat URL anywhere: iMessage, Telegram, email. Works in any Solana-compatible wallet
- **Dispute window** — prevents malicious activation when you're just on vacation
- **SOL inheritance** — full lamport-based claim from vault PDA
- **Encrypted final message** — SHA-256 hash anchored on-chain, content stored off-chain (Arweave/IPFS)
- **Trustless** — owner's private key never leaves their wallet; no custodians

---

## Architecture

### On-chain program (Anchor 0.32.1)

| Instruction | Description |
|---|---|
| `create_vault` | Initialize vault with heartbeat interval, countdown duration, dispute window, message hash |
| `add_beneficiary` | Add a beneficiary wallet with a share in basis points |
| `lock_vault` | Lock the vault (shares must total 10,000 bps) |
| `deposit` | Transfer SOL into the vault PDA |
| `heartbeat` | Owner check-in; resets countdown if active and within dispute window |
| `trigger_countdown` | Anyone can call after heartbeat interval elapses |
| `dispute` | Owner explicitly cancels an active countdown |
| `claim` | Beneficiary claims their lamport share after countdown completes |
| `close_vault` | Owner closes the vault and reclaims rent |

**PDAs:**
- Vault: `["vault", owner_pubkey]`
- Beneficiary: `["beneficiary", vault_pubkey, wallet_pubkey]`

### Blinks (Solana Actions)

Three endpoints under `/api/actions/`:

| Endpoint | Who calls it | What it does |
|---|---|---|
| `heartbeat?vault=<pubkey>` | Owner | Submits heartbeat tx, resets countdown |
| `claim?vault=<pubkey>` | Beneficiary | Submits claim tx, transfers lamports |
| `trigger?vault=<pubkey>` | Anyone | Triggers countdown after missed heartbeat |

Actions are registered at `/.well-known/solana-actions.json`.

### Frontend (Next.js 16, App Router)

| Page | Description |
|---|---|
| `/` | Landing page |
| `/create` | 4-step vault creation wizard |
| `/dashboard` | Owner dashboard: vault status, heartbeat progress bar, deposit, beneficiary table |
| `/claim` | Beneficiary claim portal |

---

## Project Structure

```
testament/
├── programs/testament/src/
│   ├── lib.rs                    # Program entrypoint
│   ├── state/
│   │   ├── vault.rs              # Vault account (118 bytes)
│   │   └── beneficiary.rs        # Beneficiary account (77 bytes)
│   ├── instructions/             # One file per instruction
│   └── errors.rs                 # Custom error codes
├── tests/
│   └── testament.ts              # Full test suite (solana-bankrun, 11 tests)
└── app/
    ├── app/
    │   ├── page.tsx              # Landing
    │   ├── create/page.tsx       # Vault wizard
    │   ├── dashboard/page.tsx    # Owner dashboard
    │   ├── claim/page.tsx        # Beneficiary claim
    │   └── api/actions/          # Blink endpoints
    ├── components/
    │   ├── Nav.tsx
    │   └── WalletProvider.tsx
    ├── hooks/
    │   └── useVault.ts           # Live vault + beneficiary account fetching
    └── lib/
        ├── program.ts            # AnchorProvider, PDA helpers
        └── idl.json              # Generated IDL from anchor build
```

---

## Local Development

### Prerequisites

- Rust (BPF toolchain via `rust-toolchain.toml`)
- Solana CLI ≥ 2.3
- Anchor CLI 0.32.1
- Node.js ≥ 18

### Build and test

```bash
# Build the program
anchor build

# Run tests (uses solana-bankrun, no local validator needed)
npx ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"

# Or via anchor (skips validator start):
anchor test --skip-local-validator
```

### Frontend

```bash
cd app
npm install
npm run dev       # http://localhost:3000
```

### Devnet deployment

```bash
anchor build
anchor deploy --provider.cluster devnet
# Program ID: 2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc
```

---

## Test Suite

11 deterministic tests using [solana-bankrun](https://github.com/kevinheavey/solana-bankrun) — no local validator, no wall-clock sleeps, runs in ~300ms.

```
✔ creates a vault
✔ adds two beneficiaries (alice 70%, bob 30%)
✔ rejects a beneficiary that would overflow 10000 bps
✔ locks the vault
✔ deposits SOL into the vault
✔ records a heartbeat
✔ rejects trigger_countdown before heartbeat_interval elapses
✔ triggers countdown after heartbeat interval elapses
✔ allows owner to dispute within the dispute window
✔ full claim flow: trigger → warp past countdown → alice + bob claim
✔ rejects a double-claim

11 passing (~300ms)
```

Time-sensitive tests use `context.setClock()` to warp the on-chain unix timestamp instead of sleeping.

---

## Competitive Landscape

|  | Testament | Eternal Key | inheritable-solana | Sarcophagus |
|---|---|---|---|---|
| Chain | Solana | Solana | Solana | EVM only |
| Asset types | SOL + SPL + NFT | SOL + SPL | SOL only | Documents |
| Beneficiaries | Up to 10, % splits | Single | Multiple (no escrow) | Single |
| Privacy | Planned (Token-2022) | None | None | None |
| Heartbeat UX | Blinks (1 click) | Manual tx | Manual | Re-wrap tx |
| Encrypted message | Yes (hash anchored) | No | No | Yes |
| Dispute window | Yes | No | No | No |
| Production-ready | Yes | Basic | Proof of concept | Yes (EVM) |

---

## Program ID

Devnet: `2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc`

---

*Colosseum Frontier Hackathon 2026 · Built on Solana*
