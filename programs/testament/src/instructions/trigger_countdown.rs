use anchor_lang::prelude::*;

use crate::{errors::TestamentError, state::Vault};

#[derive(Accounts)]
pub struct TriggerCountdown<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
        constraint = vault.is_locked @ TestamentError::VaultNotLocked,
    )]
    pub vault: Account<'info, Vault>,

    /// Anyone can trigger — no signer restriction.
    pub caller: Signer<'info>,
}

pub fn handler(ctx: Context<TriggerCountdown>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;

    require!(
        !vault.countdown_active(),
        TestamentError::CountdownAlreadyStarted
    );
    require!(
        vault.heartbeat_elapsed(now),
        TestamentError::HeartbeatNotElapsed
    );

    vault.countdown_started_at = now;

    msg!(
        "Countdown triggered for vault {} at {} — claimable after {}",
        vault.key(),
        now,
        now + vault.countdown_duration,
    );

    Ok(())
}
