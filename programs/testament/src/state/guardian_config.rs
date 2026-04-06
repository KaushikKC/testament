use anchor_lang::prelude::*;

pub const MAX_GUARDIANS: usize = 3;
pub const GUARDIAN_QUORUM: usize = 2;

/// Per-vault guardian configuration.
///
/// PDA seeds: `[b"guardian_config", vault.key().as_ref()]`
///
/// Stores up to 3 registered guardian wallets and tracks the current round
/// of votes. When GUARDIAN_QUORUM (2) unique guardians vote, the vault
/// heartbeat is reset and any active countdown is cancelled.
#[account]
#[derive(Debug)]
pub struct GuardianConfig {
    /// The vault this config belongs to.
    pub vault: Pubkey, // 32

    /// Registered guardian wallets (up to 3; Pubkey::default() padding).
    pub guardians: [Pubkey; 3], // 96

    /// Number of registered guardians (0–3).
    pub count: u8, // 1

    /// How many unique votes have been cast in the current round.
    pub pending_votes: u8, // 1

    /// Which guardians have voted in the current round (zero-padded).
    pub voters: [Pubkey; 3], // 96

    /// PDA bump.
    pub bump: u8, // 1
    // discriminator(8) + 32 + 96 + 1 + 1 + 96 + 1 = 235
}

impl GuardianConfig {
    pub const LEN: usize = 8 + 32 + 96 + 1 + 1 + 96 + 1;

    /// Returns true if `key` is a registered guardian.
    pub fn is_guardian(&self, key: &Pubkey) -> bool {
        self.guardians[..self.count as usize].contains(key)
    }

    /// Returns true if `key` has already voted in the current round.
    pub fn has_voted(&self, key: &Pubkey) -> bool {
        self.voters[..self.pending_votes as usize].contains(key)
    }

    /// Clear all votes after quorum is reached.
    pub fn clear_votes(&mut self) {
        self.pending_votes = 0;
        self.voters = [Pubkey::default(); 3];
    }
}
