use anchor_lang::prelude::*;

use crate::{
    errors::TestamentError,
    state::{vault::MAX_BENEFICIARIES, Beneficiary, Vault},
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AddBeneficiaryArgs {
    /// Share in basis points (out of 10_000). e.g. 5000 = 50%.
    pub share_bps: u16,
}

#[derive(Accounts)]
#[instruction(args: AddBeneficiaryArgs)]
pub struct AddBeneficiary<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ TestamentError::UnauthorizedOwner,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
        constraint = !vault.is_locked @ TestamentError::VaultAlreadyLocked,
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: The beneficiary wallet — validated only by address (no signing required).
    pub beneficiary_wallet: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = Beneficiary::LEN,
        seeds = [b"beneficiary", vault.key().as_ref(), beneficiary_wallet.key().as_ref()],
        bump,
    )]
    pub beneficiary: Account<'info, Beneficiary>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AddBeneficiary>, args: AddBeneficiaryArgs) -> Result<()> {
    require!(args.share_bps > 0, TestamentError::ZeroShares);

    let vault = &mut ctx.accounts.vault;

    require!(
        vault.beneficiary_count < MAX_BENEFICIARIES,
        TestamentError::MaxBeneficiariesReached
    );

    let new_total = vault
        .total_shares_bps
        .checked_add(args.share_bps)
        .ok_or(TestamentError::ArithmeticOverflow)?;

    require!(
        new_total <= crate::state::vault::TOTAL_SHARES_BPS,
        TestamentError::SharesOverflow
    );

    let beneficiary = &mut ctx.accounts.beneficiary;
    beneficiary.vault = vault.key();
    beneficiary.wallet = ctx.accounts.beneficiary_wallet.key();
    beneficiary.share_bps = args.share_bps;
    beneficiary.has_claimed = false;
    beneficiary.index = vault.beneficiary_count;
    beneficiary.bump = ctx.bumps.beneficiary;

    vault.total_shares_bps = new_total;
    vault.beneficiary_count = vault
        .beneficiary_count
        .checked_add(1)
        .ok_or(TestamentError::ArithmeticOverflow)?;

    msg!(
        "Beneficiary added: {} | share: {} bps | total: {}/10000",
        ctx.accounts.beneficiary_wallet.key(),
        args.share_bps,
        vault.total_shares_bps,
    );

    Ok(())
}
