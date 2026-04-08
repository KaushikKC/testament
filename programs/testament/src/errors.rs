use anchor_lang::prelude::*;

#[error_code]
pub enum TestamentError {
    // Vault state errors
    #[msg("Vault is not active")]
    VaultNotActive,
    #[msg("Vault is already locked and cannot be modified")]
    VaultAlreadyLocked,
    #[msg("Vault must be locked before countdown can be triggered")]
    VaultNotLocked,
    #[msg("Vault shares must total exactly 10000 basis points (100%) before locking")]
    SharesNotComplete,
    #[msg("Adding this beneficiary would exceed 10000 basis points total")]
    SharesOverflow,
    #[msg("Share amount must be greater than zero")]
    ZeroShares,
    #[msg("Maximum of 10 beneficiaries allowed per vault")]
    MaxBeneficiariesReached,

    // Heartbeat / countdown errors
    #[msg("Heartbeat interval has not elapsed yet — owner is still active")]
    HeartbeatNotElapsed,
    #[msg("Countdown has already been triggered")]
    CountdownAlreadyStarted,
    #[msg("Countdown has not been triggered yet")]
    CountdownNotStarted,
    #[msg("Dispute window has not elapsed yet — countdown is still active")]
    DisputeWindowNotElapsed,
    #[msg("Dispute window has already elapsed — vault cannot be disputed")]
    DisputeWindowElapsed,

    // Claim errors
    #[msg("This beneficiary has already claimed their share")]
    AlreadyClaimed,
    #[msg("Vault has insufficient lamports to fulfil claim")]
    InsufficientVaultBalance,

    // Authorization errors
    #[msg("Only the vault owner can perform this action")]
    UnauthorizedOwner,
    #[msg("Beneficiary wallet does not match this beneficiary account")]
    UnauthorizedBeneficiary,

    // Config errors
    #[msg("Heartbeat interval must be at least 1 hour (3600 seconds)")]
    InvalidHeartbeatInterval,
    #[msg("Countdown duration must be at least 1 day (86400 seconds)")]
    InvalidCountdownDuration,
    #[msg("Dispute window must be less than countdown duration")]
    InvalidDisputeWindow,

    // Arithmetic
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    // Guardian errors
    #[msg("Maximum of 3 guardians allowed per vault")]
    MaxGuardiansReached,
    #[msg("This wallet is already registered as a guardian")]
    GuardianAlreadyExists,
    #[msg("Signer is not a registered guardian for this vault")]
    NotAGuardian,
    #[msg("This guardian has already voted in the current round")]
    AlreadyVoted,

    // Recovery errors (Phase 3)
    #[msg("No recovery wallet is registered for this vault")]
    NoRecoveryWallet,
    #[msg("Recovery wallet does not match the registered address")]
    InvalidRecoveryWallet,
    #[msg("Guardian quorum has not been reached for this recovery")]
    GuardianQuorumNotReached,

    // Passkey errors (Phase 4)
    #[msg("Passkey verification failed — biometric signature invalid")]
    PasskeyVerificationFailed,
    #[msg("Invalid passkey public key — must be 33-byte compressed P-256 point")]
    InvalidPasskeyPubkey,
    #[msg("Passkey is required for this vault's heartbeat")]
    PasskeyRequired,
    #[msg("No passkey registered for this vault")]
    NoPasskeyRegistered,
    #[msg("secp256r1 verify instruction missing from transaction")]
    MissingSecp256r1Instruction,
    #[msg("secp256r1 verify instruction references wrong public key")]
    Secp256r1PubkeyMismatch,
}
