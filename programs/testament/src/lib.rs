use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc");

#[program]
pub mod testament {
    use super::*;

    /// Create a new inheritance vault.
    /// Sets heartbeat interval, countdown duration, dispute window, and optional message hash.
    /// Vault starts unlocked so beneficiaries can be added.
    pub fn create_vault(ctx: Context<CreateVault>, args: CreateVaultArgs) -> Result<()> {
        create_vault::handler(ctx, args)
    }

    /// Add a beneficiary to the vault.
    /// Vault must be unlocked. Shares must not exceed 10,000 bps total.
    pub fn add_beneficiary(ctx: Context<AddBeneficiary>, args: AddBeneficiaryArgs) -> Result<()> {
        add_beneficiary::handler(ctx, args)
    }

    /// Lock the vault. Shares must total exactly 10,000 bps.
    /// After locking, no beneficiary changes are allowed.
    pub fn lock_vault(ctx: Context<LockVault>) -> Result<()> {
        lock_vault::handler(ctx)
    }

    /// Deposit SOL into the vault.
    /// Vault must be locked before deposits are accepted.
    pub fn deposit(ctx: Context<Deposit>, args: DepositArgs) -> Result<()> {
        deposit::handler(ctx, args)
    }

    /// Owner check-in — proves the owner is alive and resets the heartbeat.
    /// If called during an active countdown (within dispute window), cancels the countdown.
    pub fn heartbeat(ctx: Context<Heartbeat>) -> Result<()> {
        heartbeat::handler(ctx)
    }

    /// Trigger the countdown after a missed heartbeat.
    /// Anyone can call this once the heartbeat interval has elapsed.
    /// Vault must be locked.
    pub fn trigger_countdown(ctx: Context<TriggerCountdown>) -> Result<()> {
        trigger_countdown::handler(ctx)
    }

    /// Beneficiary claims their share of the vault.
    /// Can only be called after the countdown_duration has elapsed since trigger.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        claim::handler(ctx)
    }

    /// Owner disputes a false activation within the dispute window.
    /// Resets the countdown and refreshes the heartbeat timestamp.
    pub fn dispute(ctx: Context<Dispute>) -> Result<()> {
        dispute::handler(ctx)
    }

    /// Owner closes the vault and reclaims all lamports.
    /// Cannot be called while a countdown is active.
    pub fn close_vault(ctx: Context<CloseVault>) -> Result<()> {
        close_vault::handler(ctx)
    }

    /// Deposit SPL / Token-2022 tokens (or standard Metaplex NFTs) into the vault.
    /// Creates the vault's ATA for the given mint idempotently.
    /// The caller must pass the token_program matching the mint's owner
    /// (spl_token::ID for legacy tokens, spl_token_2022::ID for Token-2022).
    pub fn deposit_spl(ctx: Context<DepositSpl>, args: DepositSplArgs) -> Result<()> {
        deposit_spl::handler(ctx, args)
    }

    /// Beneficiary claims their proportional share of a specific SPL / Token-2022 mint.
    /// Only callable after the countdown_duration has elapsed since trigger.
    pub fn claim_spl(ctx: Context<ClaimSpl>) -> Result<()> {
        claim_spl::handler(ctx)
    }

    /// Register a guardian wallet (max 3 per vault).
    /// Only the owner can add guardians. Cannot be called during an active countdown.
    pub fn add_guardian(ctx: Context<AddGuardian>) -> Result<()> {
        add_guardian::handler(ctx)
    }

    /// A registered guardian casts a liveness vote.
    /// When GUARDIAN_QUORUM (2) unique guardians vote, the vault heartbeat is reset
    /// and any active countdown is cancelled.
    pub fn guardian_heartbeat(ctx: Context<GuardianHeartbeat>) -> Result<()> {
        guardian_heartbeat::handler(ctx)
    }

    // ── Phase 3: Wallet Recovery ──

    /// Register a backup recovery wallet.
    /// If the owner ever loses their Solana keypair, this wallet (combined with
    /// guardian quorum) can authorise an ownership transfer.
    pub fn register_recovery_wallet(ctx: Context<RegisterRecoveryWallet>) -> Result<()> {
        register_recovery_wallet::handler(ctx)
    }

    /// Transfer vault ownership to a new wallet.
    /// Requires: (a) recovery_wallet signer matches vault.recovery_wallet,
    ///           (b) guardian quorum has been reached.
    /// Creates a VaultAlias PDA so downstream instructions can still resolve
    /// the vault via the new owner key.
    pub fn transfer_ownership(ctx: Context<TransferOwnership>) -> Result<()> {
        transfer_ownership::handler(ctx)
    }

    // ── Phase 4: Passkey Liveness Proof ──

    /// Register a P-256 passkey public key for biometric heartbeat verification.
    /// Once set, every heartbeat must be accompanied by a secp256r1 signature
    /// produced by the owner's device biometric (Face ID / Touch ID).
    pub fn register_passkey(ctx: Context<RegisterPasskey>, args: RegisterPasskeyArgs) -> Result<()> {
        register_passkey::handler(ctx, args)
    }

    /// Recover vault ownership using only a passkey biometric signature.
    /// The transaction must include a secp256r1 verify instruction (ix[n-1])
    /// signed over sha256(vault || new_owner || recent_blockhash) with the
    /// registered passkey. No guardian quorum needed — the biometric is proof enough.
    pub fn recover_with_passkey(ctx: Context<RecoverWithPasskey>) -> Result<()> {
        recover_with_passkey::handler(ctx)
    }
}
