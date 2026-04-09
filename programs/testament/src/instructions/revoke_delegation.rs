use anchor_lang::prelude::*;
use anchor_spl::token_interface::{revoke, Mint, Revoke, TokenAccount, TokenInterface};

use crate::{
    errors::TestamentError,
    state::{DelegationRecord, Vault},
};

#[derive(Accounts)]
pub struct RevokeDelegation<'info> {
    #[account(
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ TestamentError::UnauthorizedOwner,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,

    /// Delegation record to close — returns rent to owner.
    #[account(
        mut,
        seeds = [b"delegation", vault.key().as_ref(), token_mint.key().as_ref()],
        bump = delegation_record.bump,
        has_one = vault,
        constraint = delegation_record.owner_token_account == owner_token_account.key()
            @ TestamentError::InvalidDelegationAccount,
        close = owner,
    )]
    pub delegation_record: Account<'info, DelegationRecord>,

    /// Owner's ATA — the SPL approval will be revoked from this account.
    #[account(
        mut,
        constraint = owner_token_account.key() == delegation_record.owner_token_account
            @ TestamentError::InvalidDelegationAccount,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    pub owner: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<RevokeDelegation>) -> Result<()> {
    // CPI: spl_token::revoke — removes the delegation from the owner's token account.
    revoke(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Revoke {
                source: ctx.accounts.owner_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
    )?;

    // delegation_record is closed by Anchor (close = owner).

    msg!(
        "Delegation revoked for mint {} on vault {}",
        ctx.accounts.token_mint.key(),
        ctx.accounts.vault.key(),
    );

    Ok(())
}
