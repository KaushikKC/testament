use anchor_lang::prelude::*;

/// Records that the vault owner has approved this program (via PDA delegation)
/// to transfer up to `approved_amount` of `token_mint` on their behalf.
///
/// Seeds: ["delegation", vault, token_mint]
///
/// The PDA address is the SPL delegate set via `spl_token::approve`.
/// It can only sign within this program and only when the countdown conditions
/// are satisfied in `execute_inheritance`.
#[account]
pub struct DelegationRecord {
    /// Parent vault.
    pub vault: Pubkey,               // 32
    /// SPL mint being delegated.
    pub token_mint: Pubkey,          // 32
    /// Owner's ATA for this mint — the token account that was `approve`d.
    pub owner_token_account: Pubkey, // 32
    /// Amount approved via spl_token::approve.
    pub approved_amount: u64,        // 8
    /// Bitmask: bit i = beneficiary at index i has claimed this mint.
    pub claimed_mask: u16,           // 2
    /// PDA bump.
    pub bump: u8,                    // 1
}
// LEN = 8 (discriminator) + 32 + 32 + 32 + 8 + 2 + 1 = 115

impl DelegationRecord {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 2 + 1;
}
