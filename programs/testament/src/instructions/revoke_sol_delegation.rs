use anchor_lang::prelude::*;

use crate::{
    errors::TestamentError,
    state::{SolDelegation, Vault},
};

#[derive(Accounts)]
pub struct RevokeSolDelegation<'info> {
    #[account(
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ TestamentError::UnauthorizedOwner,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,

    /// SolDelegation PDA — closed on revoke; lamports returned to owner.
    #[account(
        mut,
        seeds = [b"sol_delegation", vault.key().as_ref()],
        bump = sol_delegation.bump,
        has_one = vault,
        close = owner,
    )]
    pub sol_delegation: Account<'info, SolDelegation>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RevokeSolDelegation>) -> Result<()> {
    let amount = ctx.accounts.sol_delegation.amount;

    // Anchor's `close = owner` transfers all lamports to owner when the instruction
    // completes. We just need to transfer the delegation amount back explicitly
    // since the account holds more lamports than just `amount` (also has rent).
    // Actually, `close` handles the full lamport transfer including rent, so
    // the owner recovers everything stored in the account.

    msg!(
        "SOL delegation revoked: {} lamports returned to owner from vault {}",
        amount,
        ctx.accounts.vault.key(),
    );

    Ok(())
}
