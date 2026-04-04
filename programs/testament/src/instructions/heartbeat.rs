use anchor_lang::prelude::*;

use crate::{errors::TestamentError, state::Vault};

#[derive(Accounts)]
pub struct Heartbeat<'info> {
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

pub fn handler(ctx: Context<Heartbeat>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;

    // If a countdown was active, the owner checking in cancels it.
    if vault.countdown_active() {
        require!(
            vault.disputable(now),
            TestamentError::DisputeWindowElapsed
        );
        vault.countdown_started_at = 0;
        msg!("Countdown cancelled — owner checked in during dispute window");
    }

    vault.last_heartbeat = now;

    msg!(
        "Heartbeat recorded for vault {} at timestamp {}",
        vault.key(),
        now,
    );

    Ok(())
}
