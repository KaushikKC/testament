// Register a native SOL delegation.
//
// Unlike SPL tokens (which use spl_token::approve and stay in the owner's wallet),
// native SOL cannot be delegated. Instead, the owner transfers the designated amount
// into a SolDelegation PDA. The owner can revoke at any time via revoke_sol_delegation.

use anchor_lang::prelude::*;

use crate::{
    errors::TestamentError,
    state::{SolDelegation, Vault},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterSolDelegationArgs {
    /// Amount of SOL to designate, in lamports.
    pub amount: u64,
}

#[derive(Accounts)]
pub struct RegisterSolDelegation<'info> {
    #[account(
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ TestamentError::UnauthorizedOwner,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
        constraint = vault.is_locked @ TestamentError::VaultNotLocked,
    )]
    pub vault: Account<'info, Vault>,

    /// SOL delegation PDA — holds the lamports on behalf of the vault.
    #[account(
        init,
        payer = owner,
        space = SolDelegation::LEN,
        seeds = [b"sol_delegation", vault.key().as_ref()],
        bump,
    )]
    pub sol_delegation: Account<'info, SolDelegation>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RegisterSolDelegation>, args: RegisterSolDelegationArgs) -> Result<()> {
    require!(args.amount > 0, TestamentError::DelegationAmountZero);

    // Verify owner has enough SOL beyond the delegation amount + rent.
    let owner_lamports = ctx.accounts.owner.lamports();
    require!(
        owner_lamports > args.amount,
        TestamentError::InsufficientVaultBalance
    );

    let sol_delegation = &mut ctx.accounts.sol_delegation;
    sol_delegation.vault = ctx.accounts.vault.key();
    sol_delegation.amount = args.amount;
    sol_delegation.claimed_mask = 0;
    sol_delegation.bump = ctx.bumps.sol_delegation;

    // Transfer SOL from owner to the SolDelegation PDA.
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.sol_delegation.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_context, args.amount)?;

    msg!(
        "SOL delegation registered: {} lamports for vault {}. Revocable at any time.",
        args.amount,
        ctx.accounts.vault.key(),
    );

    Ok(())
}
