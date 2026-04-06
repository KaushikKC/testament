// Token-2022 Confidential Transfer note:
// This instruction uses `transfer_checked` which is the standard Token-2022 CPI path.
// To enable actual confidential transfers, the mint must have the
// ConfidentialTransferMint extension initialized, and callers must:
//   1. Call `configure_account` to register the ElGamal keypair on the ATA.
//   2. Call `deposit` (confidential) + `apply_pending_balance`.
//   3. Use `transfer_with_split_proofs` with ZK sigma proofs client-side.
// The ZK proof generation is client-side work — out of scope for this program.
//
// cNFTs (compressed NFTs via Bubblegum / account compression) use Merkle proof
// transfers, not token accounts, and are out of scope.
//
// Standard Metaplex NFTs (supply=1, decimals=0) work identically to SPL tokens
// and are fully supported by this instruction.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{errors::TestamentError, state::Vault};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositSplArgs {
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(args: DepositSplArgs)]
pub struct DepositSpl<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ TestamentError::UnauthorizedOwner,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
        constraint = vault.is_locked @ TestamentError::VaultNotLocked,
    )]
    pub vault: Account<'info, Vault>,

    /// The SPL / Token-2022 mint to deposit. Pass the same token_program
    /// that owns this mint (spl_token::ID or spl_token_2022::ID).
    pub mint: InterfaceAccount<'info, Mint>,

    /// Owner's token account (source).
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub owner_ata: InterfaceAccount<'info, TokenAccount>,

    /// Vault's ATA (destination) — created idempotently if absent.
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program,
    )]
    pub vault_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositSpl>, args: DepositSplArgs) -> Result<()> {
    let decimals = ctx.accounts.mint.decimals;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.owner_ata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault_ata.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        args.amount,
        decimals,
    )?;

    msg!(
        "DepositSpl: {} tokens (decimals={}) of mint {} → vault ATA {}",
        args.amount,
        decimals,
        ctx.accounts.mint.key(),
        ctx.accounts.vault_ata.key(),
    );

    Ok(())
}
