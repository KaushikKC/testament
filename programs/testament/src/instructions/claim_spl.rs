// Claim SPL / Token-2022 tokens (including standard Metaplex NFTs) from the vault.
//
// NFT note: Standard Metaplex NFTs (supply=1, decimals=0) are fully supported.
// For an NFT mint, only the beneficiary with 10000 bps (100%) will receive
// payout=1; fractional beneficiaries receive payout=0 and the require! will
// revert. Structure NFT vaults with a single 10000-bps beneficiary per mint.
//
// has_claimed flag: this flag is shared across SOL and SPL claims on the same
// Beneficiary account. A beneficiary can claim either SOL (via `claim`) OR
// tokens for a given mint (via `claim_spl`), but not both. For multi-asset
// vaults, use separate beneficiary wallets or accept this single-claim-per-
// beneficiary limitation for the hackathon scope.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    errors::TestamentError,
    state::{Beneficiary, Vault},
};

#[derive(Accounts)]
pub struct ClaimSpl<'info> {
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

    pub mint: InterfaceAccount<'info, Mint>,

    /// Vault's ATA for this mint (source). Must exist — populated by deposit_spl.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program,
    )]
    pub vault_ata: InterfaceAccount<'info, TokenAccount>,

    /// Beneficiary's ATA for this mint (destination) — created if absent.
    #[account(
        init_if_needed,
        payer = beneficiary_signer,
        associated_token::mint = mint,
        associated_token::authority = beneficiary_signer,
        associated_token::token_program = token_program,
    )]
    pub beneficiary_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub beneficiary_signer: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimSpl>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    // Validate countdown state before touching accounts.
    {
        let vault = &ctx.accounts.vault;
        require!(vault.countdown_active(), TestamentError::CountdownNotStarted);
        require!(vault.claimable(now), TestamentError::DisputeWindowNotElapsed);
    }

    let vault_ata_balance = ctx.accounts.vault_ata.amount;
    let share_bps = ctx.accounts.beneficiary.share_bps as u64;

    let payout = vault_ata_balance
        .checked_mul(share_bps)
        .ok_or(TestamentError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(TestamentError::ArithmeticOverflow)?;

    require!(payout > 0, TestamentError::InsufficientVaultBalance);

    // Mark claimed before CPI (re-entrancy guard).
    ctx.accounts.beneficiary.has_claimed = true;

    // Capture fields needed for PDA signer before vault borrow ends.
    let vault_owner = ctx.accounts.vault.owner;
    let vault_bump = ctx.accounts.vault.bump;
    let vault_key = ctx.accounts.vault.key();
    let decimals = ctx.accounts.mint.decimals;

    let signer_seeds: &[&[&[u8]]] = &[&[b"vault", vault_owner.as_ref(), &[vault_bump]]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_ata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.beneficiary_ata.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds,
        ),
        payout,
        decimals,
    )?;

    msg!(
        "ClaimSpl: {} tokens of mint {} → {} ({}bps of vault {})",
        payout,
        ctx.accounts.mint.key(),
        ctx.accounts.beneficiary_signer.key(),
        share_bps,
        vault_key,
    );

    Ok(())
}
