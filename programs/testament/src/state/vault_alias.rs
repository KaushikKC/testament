use anchor_lang::prelude::*;

/// A thin alias PDA created when vault ownership is transferred.
/// Seeds: ["vault_alias", current_owner_pubkey]
/// Points to the original vault PDA so all downstream instructions
/// can still resolve the vault even after the owner key changes.
#[account]
pub struct VaultAlias {
    /// Address of the original vault PDA.
    pub vault: Pubkey, // 32
    /// PDA bump.
    pub bump: u8, // 1
}
// LEN = 8 (discriminator) + 32 + 1 = 41
impl VaultAlias {
    pub const LEN: usize = 8 + 32 + 1;
}
