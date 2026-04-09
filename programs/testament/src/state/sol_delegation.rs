use anchor_lang::prelude::*;

/// Holds native SOL designated for inheritance.
///
/// Unlike SPL tokens (which stay in the owner's wallet via delegation),
/// native SOL cannot be delegated via the SPL token program, so it is
/// temporarily held in this PDA. The owner can `revoke_sol_delegation`
/// at any time to withdraw — it is NOT a lockup.
///
/// Seeds: ["sol_delegation", vault]
#[account]
pub struct SolDelegation {
    /// Parent vault.
    pub vault: Pubkey, // 32
    /// Total SOL held (lamports), excluding rent.
    pub amount: u64,   // 8
    /// Bitmask: bit i = beneficiary at index i has claimed their share.
    pub claimed_mask: u16, // 2
    /// PDA bump.
    pub bump: u8,      // 1
}
// LEN = 8 (discriminator) + 32 + 8 + 2 + 1 = 51

impl SolDelegation {
    pub const LEN: usize = 8 + 32 + 8 + 2 + 1;
}
