use anchor_lang::prelude::*;

use crate::{
    errors::TestamentError,
    state::{
        guardian_config::MAX_GUARDIANS,
        GuardianConfig, Vault,
    },
};

#[derive(Accounts)]
pub struct AddGuardian<'info> {
    #[account(
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ TestamentError::UnauthorizedOwner,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
        // Guardians cannot be added while a countdown is already running.
        constraint = !vault.countdown_active() @ TestamentError::CountdownAlreadyStarted,
    )]
    pub vault: Account<'info, Vault>,

    /// GuardianConfig PDA — created on the first add_guardian call, reused thereafter.
    #[account(
        init_if_needed,
        payer = owner,
        space = GuardianConfig::LEN,
        seeds = [b"guardian_config", vault.key().as_ref()],
        bump,
    )]
    pub guardian_config: Account<'info, GuardianConfig>,

    /// The wallet to register as a guardian. Does not need to sign.
    /// CHECK: address only — no on-chain validation needed.
    pub guardian_wallet: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AddGuardian>) -> Result<()> {
    let config = &mut ctx.accounts.guardian_config;

    // First-time initialisation: set vault link and bump.
    if config.vault == Pubkey::default() {
        config.vault = ctx.accounts.vault.key();
        config.bump = ctx.bumps.guardian_config;
    }

    require!(
        config.count < MAX_GUARDIANS as u8,
        TestamentError::MaxGuardiansReached
    );

    let new_guardian = ctx.accounts.guardian_wallet.key();
    require!(
        !config.is_guardian(&new_guardian),
        TestamentError::GuardianAlreadyExists
    );

    let idx = config.count as usize;
    config.guardians[idx] = new_guardian;
    config.count = config
        .count
        .checked_add(1)
        .ok_or(TestamentError::ArithmeticOverflow)?;

    msg!(
        "Guardian added: {} ({}/{})",
        new_guardian,
        config.count,
        MAX_GUARDIANS,
    );

    Ok(())
}
