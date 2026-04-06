# Testament — Trustless On-Chain Inheritance Protocol
### Colosseum Frontier Hackathon · April 6 – May 11, 2026

---

## The Problem

**$150 billion in cryptocurrency is permanently lost every year — not to hacks, but to death.**

When a crypto holder dies without sharing their seed phrase, their assets are gone forever. No court order, no lawyer, no family member can recover them. The blockchain doesn't care about death certificates.

Existing "solutions" are broken:

| Approach | Problem |
|---|---|
| Write seed phrase in a will | Will becomes public record at probate — anyone can drain your wallet |
| Give seed phrase to a lawyer | Trusted third party, costs thousands/year, single point of failure |
| Casa / centralized custody | $3K/year subscription, Casa has your keys, US-centric |
| Eternal Key (basic Solana) | Single beneficiary, no privacy, no % splits, no messages, no dispute |
| Sarcophagus (EVM) | Documents only, not Solana, requires node operator network |
| Tell a family member | They can take your assets while you're alive |

**No one has built a privacy-first, multi-beneficiary, trustless inheritance protocol on Solana.** Until now.

---

## The Solution: Testament

Testament is a trustless on-chain inheritance protocol on Solana. You create a vault, designate beneficiaries with percentage splits, set a heartbeat interval, and leave an encrypted final message. As long as you check in regularly via a single Blink click, nothing happens. If you stop — the vault activates, and your assets flow to your beneficiaries exactly as you intended.

**No lawyers. No seed phrases in envelopes. No trusted third parties. No one can touch your assets while you're alive.**

---

## How It Works

```
1. SETUP (5 minutes)
   Owner creates vault → sets heartbeat interval (e.g., 90 days)
   → adds beneficiaries with % splits (e.g., wife 50%, kids 30%, charity 20%)
   → deposits SOL + SPL tokens + NFTs
   → writes encrypted final message
   → locks vault (shares must total 100%)

2. LIVING (ongoing)
   Owner receives periodic Blink URL via email/Telegram/iMessage
   → single click proves they're alive
   → resets the heartbeat countdown
   → costs ~0.000005 SOL per check-in

3. MISSED HEARTBEAT
   Anyone can call trigger_countdown() after heartbeat_interval passes
   → 14-day dispute window begins
   → owner can still dispute (heartbeat) to cancel activation
   → prevents false activation by malicious actors

4. ACTIVATION (after dispute window)
   Each beneficiary calls claim() via their own Blink URL
   → receives their % share of vault assets
   → amounts transferred via Token-2022 confidential transfers (hidden)
   → encrypted message unlocks and reveals

5. DISPUTE (emergency override)
   If owner is alive but incapacitated/traveling:
   → 2-of-3 guardian multisig can extend the heartbeat on their behalf
   → dispute window gives 14 days to recover access
```

---

## Core Differentiators

### 1. Privacy — Confidential Transfer Amounts
Every inheritance transfer uses **Token-2022 Confidential Balances**. Beneficiaries receive their share, but nobody on-chain can see the amount — not the other beneficiaries, not the public, not the creator's employer or government. This is the only inheritance protocol in crypto with private amounts.

### 2. Multi-Beneficiary % Splits
Specify up to 10 beneficiaries with basis point precision (1 bp = 0.01%). Shares must total 10,000 bps (100%) before the vault locks. Each beneficiary claims independently. No coordination needed.

### 3. Blinks — One-Click Heartbeat
Your heartbeat is a Solana Action (Blink) — a URL that works in any compatible wallet, browser, or Telegram bot. You can paste it into iMessage and your family member can click it if you're incapacitated. No app install required.

### 4. Encrypted Final Message
Leave a last message — personal notes, password hints, where the hardware wallet is, what the accounts are — encrypted with the beneficiaries' public keys. Revealed only on vault activation. Stored off-chain (Arweave/IPFS), hash anchored on-chain.

### 5. Dispute Window
After a missed heartbeat triggers the countdown, there's a configurable dispute window (default 14 days) during which the owner can still cancel activation. Prevents someone from maliciously triggering your countdown when you're just on vacation.

### 6. Guardian Multisig Extension
Designate 3 trusted guardians (family members, friends, lawyer). Any 2-of-3 can extend your heartbeat once per period on your behalf. For when you're hospitalized and can't check in yourself.

### 7. Full Portfolio — SOL + SPL + NFTs
Inherit everything: liquid SOL, any SPL token (USDC, JTO, JUP, etc.), and compressed or standard NFTs. Not just a single-asset escrow.

---

## Technical Architecture

### Solana Program (Anchor)

```
programs/testament/src/
├── lib.rs                      # Program entrypoint, instruction routing
├── state/
│   ├── vault.rs                # Vault account (~160 bytes)
│   └── beneficiary.rs          # Beneficiary account (~80 bytes)
├── instructions/
│   ├── create_vault.rs         # Initialize vault with intervals + message hash
│   ├── add_beneficiary.rs      # Add beneficiary with share_bps
│   ├── lock_vault.rs           # Lock vault (shares must = 10000 bps)
│   ├── deposit.rs              # Deposit SOL into vault PDA
│   ├── heartbeat.rs            # Owner check-in, resets countdown
│   ├── trigger_countdown.rs    # Anyone triggers after missed heartbeat
│   ├── claim.rs                # Beneficiary claims share post-countdown
│   ├── dispute.rs              # Owner disputes false activation
│   └── close_vault.rs          # Owner closes vault, reclaims lamports
└── errors.rs                   # Custom error codes
```

**Account PDAs:**
- Vault: `[b"vault", owner.key().as_ref()]`
- Beneficiary: `[b"beneficiary", vault.key().as_ref(), wallet.key().as_ref()]`

**Vault State:**
```rust
pub struct Vault {
    pub owner: Pubkey,              // 32 — vault owner
    pub heartbeat_interval: i64,    // 8  — seconds between required check-ins
    pub last_heartbeat: i64,        // 8  — unix timestamp of last check-in
    pub countdown_duration: i64,    // 8  — grace period (e.g. 14 days = 1_209_600)
    pub countdown_started_at: i64,  // 8  — 0 if not started
    pub dispute_window: i64,        // 8  — how long owner can dispute after countdown
    pub beneficiary_count: u8,      // 1  — number of beneficiaries
    pub total_shares_bps: u16,      // 2  — must equal 10000 when locked
    pub is_locked: bool,            // 1  — no beneficiary changes after lock
    pub is_active: bool,            // 1  — false if closed
    pub message_hash: [u8; 32],     // 32 — SHA256 of encrypted off-chain message
    pub bump: u8,                   // 1
}
```

**Beneficiary State:**
```rust
pub struct Beneficiary {
    pub vault: Pubkey,      // 32 — parent vault
    pub wallet: Pubkey,     // 32 — beneficiary's wallet
    pub share_bps: u16,     // 2  — share in basis points (out of 10000)
    pub has_claimed: bool,  // 1
    pub index: u8,          // 1  — position in beneficiary list
    pub bump: u8,           // 1
}
```

### Token-2022 Confidential Transfers
- Vault holds tokens in a Token-2022 account with `ConfidentialTransferAccount` extension enabled
- At claim time, `apply_pending_balance` + `transfer_with_split_proofs` executes the confidential transfer
- ElGamal keypair generated client-side per beneficiary, public key stored in beneficiary account
- Transfer amounts encrypted to each beneficiary's ElGamal public key

### Blinks (Solana Actions)
Two Blink endpoints:
- `GET/POST /api/actions/heartbeat?vault={pubkey}` — owner check-in
- `GET/POST /api/actions/claim?vault={pubkey}&beneficiary={pubkey}` — beneficiary claim

Both return `ActionGetResponse` metadata and handle the transaction signing + submission.

### Off-Chain Message Storage
- Encrypted final message stored on Arweave (permanent) or IPFS
- SHA256 hash of encrypted content anchored in `vault.message_hash`
- Encryption: each beneficiary's public key used to encrypt a symmetric key (hybrid encryption)
- Decryption only possible after vault activation + beneficiary has their private key

### Frontend (Next.js + Wallet Adapter)
```
app/
├── pages/
│   ├── index.tsx               # Landing / hero
│   ├── dashboard.tsx           # Owner dashboard (vault status, beneficiaries, heartbeat)
│   ├── create.tsx              # Vault creation wizard (4 steps)
│   ├── claim/[vault].tsx       # Beneficiary claim portal
│   └── api/
│       └── actions/
│           ├── heartbeat.ts    # Blink endpoint
│           └── claim.ts        # Blink endpoint
├── components/
│   ├── VaultCard.tsx           # Vault status card with countdown timer
│   ├── BeneficiaryManager.tsx  # Add/remove/adjust beneficiary splits
│   ├── HeartbeatBlink.tsx      # Copy-able Blink URL + QR code
│   └── ClaimPortal.tsx         # Beneficiary claim UI
└── hooks/
    ├── useVault.ts             # Fetch and parse vault account
    └── useBeneficiary.ts       # Fetch beneficiary accounts
```

---

## Competitive Landscape

| | Testament | Eternal Key | inheritable-solana | Sarcophagus |
|---|---|---|---|---|
| Chain | Solana | Solana | Solana | EVM (Base) |
| Asset types | SOL + SPL + NFT | SOL + SPL | SOL only | Documents |
| Beneficiaries | Up to 10, % splits | Single | Multiple (no escrow) | Single |
| Privacy | Confidential amounts | None | None | None |
| Heartbeat UX | Blinks (1 click) | Manual tx | Manual | Re-wrap tx |
| Encrypted message | Yes (Arweave) | No | No | Yes (Arweave) |
| Dispute window | Yes (14 days) | No | No | No |
| Guardian backup | Yes (2-of-3) | No | No | No |
| Production-ready | Target | Basic | Proof of concept | Yes (EVM) |
| Open source | Yes | Yes | Yes | Yes |

---

## Roadmap

### Week 1 — Anchor Program Core
- [x] Project scaffold (Anchor 0.32.1)
- [ ] State accounts: Vault, Beneficiary
- [ ] Instructions: create_vault, add_beneficiary, lock_vault, deposit, heartbeat
- [ ] Instructions: trigger_countdown, claim, dispute, close_vault
- [ ] Error codes
- [ ] Anchor build passing

### Week 2 — Token-2022 + Tests
- [ ] Token-2022 confidential transfer integration for SPL claims
- [ ] NFT transfer support (Metaplex Core / cNFT)
- [ ] TypeScript test suite (all instructions, happy path + edge cases)
- [ ] Deploy to Devnet

### Week 3 — Blinks + API
- [ ] `/api/actions/heartbeat` Blink endpoint
- [ ] `/api/actions/claim` Blink endpoint
- [ ] Blinks registered in `actions.json`
- [ ] QR code generation for heartbeat URL

### Week 4 — Frontend
- [ ] Landing page
- [ ] Vault creation wizard (4-step flow)
- [ ] Owner dashboard (vault status, countdown timer, beneficiary table)
- [ ] Beneficiary claim portal
- [ ] Wallet adapter integration (Phantom, Backpack, Solflare)

### Week 5 — Polish + Demo
- [ ] Guardian multisig extension flow
- [ ] Encrypted message upload (Arweave via Irys)
- [ ] End-to-end demo script
- [ ] Devnet deployment with real test scenarios
- [ ] Pitch deck + video demo

---

## Business Model (Post-Hackathon)

**Protocol fee: 0.5% at claim time**
- Charged as a small % of assets claimed
- Collected by protocol treasury PDA automatically
- Projected: if 1,000 vaults average $10K each, $50M in managed assets → $250K in fees at full claim

**Premium features (subscription):**
- Guardian multisig management UI ($5/month)
- Arweave message storage sponsorship (no IPFS setup)
- Legal document integration (generate a letter for your lawyer)
- Mobile app push notifications for heartbeat reminders

**No token required.** Revenue is in SOL/USDC from day one.

---

## Why Testament Wins the Frontier Hackathon

1. **Real problem, emotional resonance** — Every person in the room has thought about what happens to their crypto when they die. Judges feel this immediately.

2. **Zero production-ready competition on Solana** — Eternal Key is basic. Testament is comprehensive. Sarcophagus is EVM. The field is open.

3. **Privacy angle is novel** — First inheritance protocol anywhere with confidential amounts. No competitor has this.

4. **Blinks are underutilized** — Most Blink demos are trading. Using Blinks as a heartbeat mechanism is genuinely creative and shows Solana-native thinking.

5. **Full portfolio inheritance** — SOL + SPL + NFTs in one vault. Nobody else does this.

6. **Demo-able in 5 minutes** — Create vault → set 1-minute heartbeat → let it expire → trigger countdown → claim. Judges can see the full flow.

7. **Post-hackathon business** — Clear revenue model, no token, massive TAM ($150B+ in lost crypto annually), clear path to Colosseum accelerator.

---

## Team

| Role | Responsibilities |
|---|---|
| Solana Engineer | Anchor program, Token-2022 integration, Devnet deployment |
| Frontend Engineer | Next.js app, wallet adapter, Blinks API |
| Product / Design | UX flow, pitch deck, demo script |

---

*Built for the Colosseum Frontier Hackathon — April 6 to May 11, 2026*
*"Your assets. Your rules. Even after you're gone."*
