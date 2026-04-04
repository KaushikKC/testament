use anchor_lang::prelude::*;

use crate::{errors::TestamentError, state::Vault};

/// The owner explicitly disputes a countdown that was incorrectly triggered.
/// Can only be called while the dispute window is still open.
/// Resets the countdown and records a new heartbeat.
#[derive(Accounts)]
pub struct Dispute<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ TestamentError::UnauthorizedOwner,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,

    pub owner: Signer<'info>,
}

pub fn handler(ctx: Context<Dispute>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;

    require!(vault.countdown_active(), TestamentError::CountdownNotStarted);
    require!(vault.disputable(now), TestamentError::DisputeWindowElapsed);

    vault.countdown_started_at = 0;
    vault.last_heartbeat = now;

    msg!(
        "Dispute accepted for vault {} — countdown reset, heartbeat refreshed at {}",
        vault.key(),
        now,
    );

    Ok(())
}
