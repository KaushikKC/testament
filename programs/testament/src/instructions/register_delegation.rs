use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{approve, Approve, Mint, TokenAccount, TokenInterface},
};

use crate::{
    errors::TestamentError,
    state::{DelegationRecord, Vault},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterDelegationArgs {
    /// How much of this token to designate for inheritance.
    pub amount: u64,
}

#[derive(Accounts)]
pub struct RegisterDelegation<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ TestamentError::UnauthorizedOwner,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
        constraint = vault.is_locked @ TestamentError::VaultNotLocked,
    )]
    pub vault: Account<'info, Vault>,

    /// One delegation record per (vault, mint) pair.
    #[account(
        init,
        payer = owner,
        space = DelegationRecord::LEN,
        seeds = [b"delegation", vault.key().as_ref(), token_mint.key().as_ref()],
        bump,
    )]
    pub delegation_record: Account<'info, DelegationRecord>,

    /// Owner's ATA for this mint — the `approve` will be set on this account.
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RegisterDelegation>, args: RegisterDelegationArgs) -> Result<()> {
    require!(args.amount > 0, TestamentError::DelegationAmountZero);

    let delegation_record = &mut ctx.accounts.delegation_record;
    delegation_record.vault = ctx.accounts.vault.key();
    delegation_record.token_mint = ctx.accounts.token_mint.key();
    delegation_record.owner_token_account = ctx.accounts.owner_token_account.key();
    delegation_record.approved_amount = args.amount;
    delegation_record.claimed_mask = 0;
    delegation_record.bump = ctx.bumps.delegation_record;

    // CPI: spl_token::approve — sets DelegationRecord PDA as the delegate
    // so it can sign transfer_checked in execute_inheritance.
    approve(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Approve {
                to: ctx.accounts.owner_token_account.to_account_info(),
                delegate: ctx.accounts.delegation_record.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        args.amount,
    )?;

    msg!(
        "Delegation registered: {} tokens of mint {} for vault {}. Funds stay in your wallet.",
        args.amount,
        ctx.accounts.token_mint.key(),
        ctx.accounts.vault.key(),
    );

    Ok(())
}
