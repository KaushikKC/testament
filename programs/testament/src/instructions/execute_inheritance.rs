// Execute an SPL token inheritance transfer.
//
// PERMISSIONLESS — anyone (our keeper bot, or anyone else) can call this once
// the countdown has completed. The DelegationRecord PDA signs the transfer_checked
// CPI so tokens flow from the owner's wallet directly to the beneficiary's ATA.
// There is no "claim" UX — the keeper calls this automatically for every
// beneficiary + delegation record the moment countdown ends.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    errors::TestamentError,
    state::{Beneficiary, DelegationRecord, Vault},
};

#[derive(Accounts)]
pub struct ExecuteInheritance<'info> {
    #[account(
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"delegation", vault.key().as_ref(), token_mint.key().as_ref()],
        bump = delegation_record.bump,
        has_one = vault,
    )]
    pub delegation_record: Account<'info, DelegationRecord>,

    /// The vault owner's token account — still in their wallet, never moved.
    #[account(
        mut,
        constraint = owner_token_account.key() == delegation_record.owner_token_account
            @ TestamentError::InvalidDelegationAccount,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Beneficiary PDA — seeded by [beneficiary, vault, beneficiary_wallet].
    #[account(
        seeds = [b"beneficiary", vault.key().as_ref(), beneficiary_wallet.key().as_ref()],
        bump = beneficiary.bump,
        has_one = vault,
        constraint = beneficiary.wallet == beneficiary_wallet.key()
            @ TestamentError::UnauthorizedBeneficiary,
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    /// Beneficiary's ATA for this mint (destination) — created if absent.
    /// Payer is the caller (keeper), not the beneficiary.
    #[account(
        init_if_needed,
        payer = caller,
        associated_token::mint = token_mint,
        associated_token::authority = beneficiary_wallet,
        associated_token::token_program = token_program,
    )]
    pub beneficiary_ata: InterfaceAccount<'info, TokenAccount>,

    /// Destination wallet — must match beneficiary.wallet stored on-chain.
    /// CHECK: verified by the constraint on beneficiary above.
    pub beneficiary_wallet: UncheckedAccount<'info>,

    /// Fee payer — anyone can call this (keeper bot, relayer, anyone).
    /// They pay the tiny transaction fee and ATA creation rent if needed.
    /// Funds always go to beneficiary_wallet regardless of who the caller is.
    #[account(mut)]
    pub caller: Signer<'info>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ExecuteInheritance>) -> Result<()> {
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
        ctx.accounts.delegation_record.claimed_mask & mask == 0,
        TestamentError::AlreadyClaimed
    );

    // Compute proportional share from live balance at execution time.
    let balance = ctx.accounts.owner_token_account.amount;
    let approved = ctx.accounts.delegation_record.approved_amount;
    let available = balance.min(approved);
    let share_bps = ctx.accounts.beneficiary.share_bps as u64;

    let share = available
        .checked_mul(share_bps)
        .ok_or(TestamentError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(TestamentError::ArithmeticOverflow)?;

    require!(share > 0, TestamentError::InsufficientVaultBalance);

    // Mark as executed before CPI (re-entrancy guard).
    ctx.accounts.delegation_record.claimed_mask |= mask;

    let vault_key = ctx.accounts.vault.key();
    let mint_key = ctx.accounts.token_mint.key();
    let bump = ctx.accounts.delegation_record.bump;
    let decimals = ctx.accounts.token_mint.decimals;

    // CPI: transfer_checked — DelegationRecord PDA signs as the SPL delegate.
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"delegation",
        vault_key.as_ref(),
        mint_key.as_ref(),
        &[bump],
    ]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.owner_token_account.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.beneficiary_ata.to_account_info(),
                authority: ctx.accounts.delegation_record.to_account_info(),
            },
            signer_seeds,
        ),
        share,
        decimals,
    )?;

    msg!(
        "InheritanceExecuted: {} tokens of mint {} → {} (index {}, {}bps, vault {})",
        share,
        mint_key,
        ctx.accounts.beneficiary_wallet.key(),
        index,
        share_bps,
        vault_key,
    );

    Ok(())
}
