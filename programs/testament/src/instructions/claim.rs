use anchor_lang::prelude::*;

use crate::{errors::TestamentError, state::{Beneficiary, Vault}};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"beneficiary", vault.key().as_ref(), beneficiary_signer.key().as_ref()],
        bump = beneficiary.bump,
        has_one = vault,
        constraint = beneficiary.wallet == beneficiary_signer.key() @ TestamentError::UnauthorizedBeneficiary,
        constraint = !beneficiary.has_claimed @ TestamentError::AlreadyClaimed,
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    #[account(mut)]
    pub beneficiary_signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Claim>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    {
        let vault = &ctx.accounts.vault;
        require!(vault.countdown_active(), TestamentError::CountdownNotStarted);
        require!(vault.claimable(now), TestamentError::DisputeWindowNotElapsed);
    }

    // Calculate the lamport share — do this before mutating accounts.
    let vault_lamports = ctx.accounts.vault.get_lamports();
    let share_bps = ctx.accounts.beneficiary.share_bps as u64;

    let payout = vault_lamports
        .checked_mul(share_bps)
        .ok_or(TestamentError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(TestamentError::ArithmeticOverflow)?;

    require!(payout > 0, TestamentError::InsufficientVaultBalance);

    // Mark claimed before transferring (re-entrancy guard pattern).
    ctx.accounts.beneficiary.has_claimed = true;

    // Transfer lamports from vault PDA to beneficiary.
    // The vault PDA is a program-owned account, so we subtract/add directly.
    **ctx
        .accounts
        .vault
        .to_account_info()
        .try_borrow_mut_lamports()? -= payout;

    **ctx
        .accounts
        .beneficiary_signer
        .to_account_info()
        .try_borrow_mut_lamports()? += payout;

    msg!(
        "Claim: {} lamports → {} ({}bps of vault {})",
        payout,
        ctx.accounts.beneficiary_signer.key(),
        share_bps,
        ctx.accounts.vault.key(),
    );

    Ok(())
}
