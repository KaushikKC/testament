use anchor_lang::prelude::*;

/// Maximum number of beneficiaries per vault.
pub const MAX_BENEFICIARIES: u8 = 10;

/// Total shares in basis points (100% = 10_000 bps).
pub const TOTAL_SHARES_BPS: u16 = 10_000;

/// Minimum heartbeat interval: 1 minute (lowered for demo/testing).
pub const MIN_HEARTBEAT_INTERVAL: i64 = 60;

/// Minimum countdown duration: 2 minutes (lowered for demo/testing).
pub const MIN_COUNTDOWN_DURATION: i64 = 120;

#[account]
#[derive(Debug)]
pub struct Vault {
    /// The wallet that owns this vault and must send regular heartbeats.
    pub owner: Pubkey, // 32

    /// How often (in seconds) the owner must check in.
    /// Default: 7_776_000 (90 days).
    pub heartbeat_interval: i64, // 8

    /// Unix timestamp of the last successful heartbeat.
    pub last_heartbeat: i64, // 8

    /// How long (in seconds) the dispute/countdown window lasts after
    /// a missed heartbeat is detected. Default: 1_209_600 (14 days).
    pub countdown_duration: i64, // 8

    /// Unix timestamp when the countdown was triggered.
    /// 0 means no countdown is active.
    pub countdown_started_at: i64, // 8

    /// How long (in seconds) the owner has to dispute a false activation
    /// after countdown starts. Must be < countdown_duration.
    /// Default: 604_800 (7 days).
    pub dispute_window: i64, // 8

    /// Number of beneficiaries registered.
    pub beneficiary_count: u8, // 1

    /// Sum of all beneficiary share_bps. Must equal TOTAL_SHARES_BPS
    /// before the vault can be locked.
    pub total_shares_bps: u16, // 2

    /// Whether the vault has been locked (no more beneficiary changes).
    pub is_locked: bool, // 1

    /// Whether the vault is active. Set to false after owner closes it.
    pub is_active: bool, // 1

    /// SHA-256 hash of the encrypted final message stored off-chain
    /// (Arweave / IPFS). Zero bytes = no message set.
    pub message_hash: [u8; 32], // 32

    /// PDA bump.
    pub bump: u8, // 1
}
// Discriminator (8) + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 2 + 1 + 1 + 32 + 1 = 118 bytes

impl Vault {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 2 + 1 + 1 + 32 + 1;

    /// Returns true if the heartbeat interval has elapsed since the last check-in.
    pub fn heartbeat_elapsed(&self, now: i64) -> bool {
        now >= self.last_heartbeat + self.heartbeat_interval
    }

    /// Returns true if the countdown is currently active.
    pub fn countdown_active(&self) -> bool {
        self.countdown_started_at > 0
    }

    /// Returns true if the dispute window has elapsed (vault can be claimed).
    pub fn claimable(&self, now: i64) -> bool {
        self.countdown_active()
            && now >= self.countdown_started_at + self.countdown_duration
    }

    /// Returns true if the owner can still dispute (dispute window still open).
    pub fn disputable(&self, now: i64) -> bool {
        self.countdown_active()
            && now < self.countdown_started_at + self.dispute_window
    }
}
