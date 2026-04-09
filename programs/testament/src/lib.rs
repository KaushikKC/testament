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

    /// Owner check-in — proves the owner is alive and resets the heartbeat timer.
    /// If passkey is registered, the transaction must include a secp256r1 verify
    /// instruction signed with the owner's biometric (Face ID / Touch ID).
    /// If called during an active countdown (within dispute window), cancels the countdown.
    pub fn heartbeat(ctx: Context<Heartbeat>) -> Result<()> {
        heartbeat::handler(ctx)
    }

    /// Trigger the countdown after a missed check-in.
    /// Anyone can call this once the heartbeat interval has elapsed.
    /// Vault must be locked.
    pub fn trigger_countdown(ctx: Context<TriggerCountdown>) -> Result<()> {
        trigger_countdown::handler(ctx)
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

    // ── Phase 1: Conditional Delegation ──

    /// Designate SPL tokens for inheritance without moving them from your wallet.
    /// Creates a DelegationRecord PDA and calls spl_token::approve so this program
    /// can transfer on your behalf only when the countdown conditions are met.
    /// Vault must be locked before delegations can be registered.
    pub fn register_delegation(
        ctx: Context<RegisterDelegation>,
        args: RegisterDelegationArgs,
    ) -> Result<()> {
        register_delegation::handler(ctx, args)
    }

    /// Revoke an SPL token delegation. Cancels the spl_token::approve and
    /// closes the DelegationRecord account, returning rent to the owner.
    /// Can be called at any time while the vault is active.
    pub fn revoke_delegation(ctx: Context<RevokeDelegation>) -> Result<()> {
        revoke_delegation::handler(ctx)
    }

    /// Beneficiary claims their proportional share of a delegated SPL token.
    /// Only callable after countdown_duration has elapsed since trigger.
    /// Tokens transfer directly from the owner's wallet to the beneficiary.
    pub fn execute_inheritance(ctx: Context<ExecuteInheritance>) -> Result<()> {
        execute_inheritance::handler(ctx)
    }

    /// Designate native SOL for inheritance.
    /// SOL is transferred into a SolDelegation PDA (cannot be SPL-delegated).
    /// The owner can revoke at any time via revoke_sol_delegation.
    pub fn register_sol_delegation(
        ctx: Context<RegisterSolDelegation>,
        args: RegisterSolDelegationArgs,
    ) -> Result<()> {
        register_sol_delegation::handler(ctx, args)
    }

    /// Withdraw SOL from the SolDelegation PDA back to the owner's wallet.
    /// This is the safety valve — no lockup, fully revocable while alive.
    pub fn revoke_sol_delegation(ctx: Context<RevokeSolDelegation>) -> Result<()> {
        revoke_sol_delegation::handler(ctx)
    }

    /// Beneficiary claims their proportional share of the designated SOL.
    /// Only callable after countdown_duration has elapsed since trigger.
    pub fn execute_sol_inheritance(ctx: Context<ExecuteSolInheritance>) -> Result<()> {
        execute_sol_inheritance::handler(ctx)
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
    pub fn register_passkey(
        ctx: Context<RegisterPasskey>,
        args: RegisterPasskeyArgs,
    ) -> Result<()> {
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
