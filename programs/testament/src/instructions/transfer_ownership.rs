use anchor_lang::prelude::*;

use crate::{
    errors::TestamentError,
    state::{GuardianConfig, Vault, VaultAlias, GUARDIAN_QUORUM},
};

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    #[account(
        mut,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
        constraint = vault.has_recovery_wallet @ TestamentError::NoRecoveryWallet,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"guardian_config", vault.key().as_ref()],
        bump = guardian_config.bump,
        constraint = guardian_config.vault == vault.key(),
    )]
    pub guardian_config: Account<'info, GuardianConfig>,

    /// The pre-registered recovery wallet — must be the signer (pays for alias PDA rent).
    #[account(
        mut,
        constraint = recovery_wallet.key() == vault.recovery_wallet @ TestamentError::InvalidRecoveryWallet,
    )]
    pub recovery_wallet: Signer<'info>,

    /// CHECK: The new owner pubkey — only stored, not signed here.
    pub new_owner_wallet: UncheckedAccount<'info>,

    /// Alias PDA created at [b"vault_alias", new_owner_wallet].
    #[account(
        init,
        payer = recovery_wallet,
        space = VaultAlias::LEN,
        seeds = [b"vault_alias", new_owner_wallet.key().as_ref()],
        bump,
    )]
    pub vault_alias: Account<'info, VaultAlias>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<TransferOwnership>) -> Result<()> {
    let guardian_config = &ctx.accounts.guardian_config;

    // Require guardian quorum
    require!(
        guardian_config.pending_votes as usize >= GUARDIAN_QUORUM,
        TestamentError::GuardianQuorumNotReached
    );

    let vault = &mut ctx.accounts.vault;
    let new_owner = ctx.accounts.new_owner_wallet.key();

    // Update vault owner
    vault.owner = new_owner;

    // Clear guardian votes
    ctx.accounts.guardian_config.clear_votes();

    // Initialise alias PDA pointing to the original vault
    let alias = &mut ctx.accounts.vault_alias;
    alias.vault = vault.key();
    alias.bump = ctx.bumps.vault_alias;

    msg!(
        "Vault {} ownership transferred to {}. Alias PDA created.",
        vault.key(),
        new_owner
    );

    Ok(())
}
