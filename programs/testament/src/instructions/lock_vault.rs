use anchor_lang::prelude::*;

use crate::{
    errors::TestamentError,
    state::{vault::TOTAL_SHARES_BPS, Vault},
};

#[derive(Accounts)]
pub struct LockVault<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ TestamentError::UnauthorizedOwner,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
        constraint = !vault.is_locked @ TestamentError::VaultAlreadyLocked,
    )]
    pub vault: Account<'info, Vault>,

    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<LockVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    require!(
        vault.total_shares_bps == TOTAL_SHARES_BPS,
        TestamentError::SharesNotComplete
    );

    vault.is_locked = true;

    msg!(
        "Vault locked: {} | {} beneficiaries | shares: 10000/10000",
        vault.key(),
        vault.beneficiary_count,
    );

    Ok(())
}
