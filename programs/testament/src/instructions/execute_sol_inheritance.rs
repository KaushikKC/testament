// Execute a native SOL inheritance transfer.
//
// PERMISSIONLESS — anyone (our keeper bot, or anyone else) can call this once
// the countdown has completed. Funds always go to the registered beneficiary
// wallet stored in the Beneficiary PDA. There is no "claim" UX; the keeper
// calls this automatically for every beneficiary the moment the countdown ends.

use anchor_lang::prelude::*;

use crate::{
    errors::TestamentError,
    state::{Beneficiary, SolDelegation, Vault},
};

#[derive(Accounts)]
pub struct ExecuteSolInheritance<'info> {
    #[account(
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"sol_delegation", vault.key().as_ref()],
        bump = sol_delegation.bump,
        has_one = vault,
    )]
    pub sol_delegation: Account<'info, SolDelegation>,

    /// Beneficiary PDA — seeded by [beneficiary, vault, beneficiary_wallet].
    #[account(
        seeds = [b"beneficiary", vault.key().as_ref(), beneficiary_wallet.key().as_ref()],
        bump = beneficiary.bump,
        has_one = vault,
        constraint = beneficiary.wallet == beneficiary_wallet.key()
            @ TestamentError::UnauthorizedBeneficiary,
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    /// Destination wallet — must match beneficiary.wallet stored on-chain.
    /// CHECK: verified by the constraint above; receives SOL directly.
    #[account(mut)]
    pub beneficiary_wallet: UncheckedAccount<'info>,

    /// Fee payer — anyone can call this (keeper bot, relayer, anyone).
    /// They pay the tiny transaction fee (~0.000005 SOL). Funds still go
    /// to beneficiary_wallet regardless of who the caller is.
    #[account(mut)]
    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ExecuteSolInheritance>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    {
        let vault = &ctx.accounts.vault;
        require!(vault.countdown_active(), TestamentError::CountdownNotStarted);
        require!(vault.claimable(now), TestamentError::DisputeWindowNotElapsed);
    }

    let index = ctx.accounts.beneficiary.index;
    let mask = 1u16
        .checked_shl(index as u32)
        .ok_or(TestamentError::ArithmeticOverflow)?;

    require!(
        ctx.accounts.sol_delegation.claimed_mask & mask == 0,
        TestamentError::AlreadyClaimed
    );

    let total = ctx.accounts.sol_delegation.amount;
    let share_bps = ctx.accounts.beneficiary.share_bps as u64;

    let share = total
        .checked_mul(share_bps)
        .ok_or(TestamentError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(TestamentError::ArithmeticOverflow)?;

    require!(share > 0, TestamentError::InsufficientVaultBalance);

    let pda_lamports = ctx.accounts.sol_delegation.get_lamports();
    require!(pda_lamports >= share, TestamentError::InsufficientVaultBalance);

    // Mark as executed before transfer (re-entrancy guard).
    ctx.accounts.sol_delegation.claimed_mask |= mask;

    // Transfer lamports from SolDelegation PDA to beneficiary wallet.
    **ctx
        .accounts
        .sol_delegation
        .to_account_info()
        .try_borrow_mut_lamports()? -= share;

    **ctx
        .accounts
        .beneficiary_wallet
        .to_account_info()
        .try_borrow_mut_lamports()? += share;

    msg!(
        "SolInheritanceExecuted: {} lamports → {} (index {}, {}bps, vault {})",
        share,
        ctx.accounts.beneficiary_wallet.key(),
        index,
        share_bps,
        ctx.accounts.vault.key(),
    );

    Ok(())
}
