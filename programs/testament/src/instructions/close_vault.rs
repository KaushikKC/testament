use anchor_lang::prelude::*;

use crate::{errors::TestamentError, state::Vault};

/// Owner closes the vault and reclaims all lamports.
/// Can only be called when no countdown is active (owner must be alive and present).
#[derive(Accounts)]
pub struct CloseVault<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ TestamentError::UnauthorizedOwner,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
        constraint = !vault.countdown_active() @ TestamentError::CountdownAlreadyStarted,
        close = owner,
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CloseVault>) -> Result<()> {
    msg!(
        "Vault {} closed by owner {} — all lamports returned",
        ctx.accounts.vault.key(),
        ctx.accounts.owner.key(),
    );
    Ok(())
}
