use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct Beneficiary {
    /// The vault this beneficiary belongs to.
    pub vault: Pubkey, // 32

    /// The beneficiary's wallet address (receives the share).
    pub wallet: Pubkey, // 32

    /// Share in basis points (out of 10_000).
    /// e.g. 5_000 = 50%, 2_500 = 25%, 100 = 1%.
    pub share_bps: u16, // 2

    /// Whether this beneficiary has already claimed their share.
    pub has_claimed: bool, // 1

    /// Zero-indexed position (for PDA seed uniqueness if same wallet used twice — prevented by PDA).
    pub index: u8, // 1

    /// PDA bump.
    pub bump: u8, // 1
}
// Discriminator (8) + 32 + 32 + 2 + 1 + 1 + 1 = 77 bytes

impl Beneficiary {
    pub const LEN: usize = 8 + 32 + 32 + 2 + 1 + 1 + 1;
}
