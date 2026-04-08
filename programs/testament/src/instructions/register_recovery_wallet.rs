use anchor_lang::prelude::*;

use crate::{errors::TestamentError, state::Vault};

#[derive(Accounts)]
pub struct RegisterRecoveryWallet<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ TestamentError::UnauthorizedOwner,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: This is the backup wallet address — we only store its pubkey.
    pub recovery_wallet: UncheckedAccount<'info>,

    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<RegisterRecoveryWallet>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    vault.recovery_wallet = ctx.accounts.recovery_wallet.key();
    vault.has_recovery_wallet = true;

    msg!(
        "Recovery wallet {} registered for vault {}",
        vault.recovery_wallet,
        vault.key()
    );

    Ok(())
}
