use anchor_lang::prelude::*;

use crate::{
    errors::TestamentError,
    state::{
        guardian_config::GUARDIAN_QUORUM,
        GuardianConfig, Vault,
    },
};

#[derive(Accounts)]
pub struct GuardianHeartbeat<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"guardian_config", vault.key().as_ref()],
        bump = guardian_config.bump,
        constraint = guardian_config.vault == vault.key() @ TestamentError::UnauthorizedOwner,
    )]
    pub guardian_config: Account<'info, GuardianConfig>,

    /// A registered guardian signing the liveness vote.
    pub guardian: Signer<'info>,
}

pub fn handler(ctx: Context<GuardianHeartbeat>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let guardian_key = ctx.accounts.guardian.key();

    // Validate before mutating.
    {
        let config = &ctx.accounts.guardian_config;
        require!(
            config.is_guardian(&guardian_key),
            TestamentError::NotAGuardian
        );
        require!(
            !config.has_voted(&guardian_key),
            TestamentError::AlreadyVoted
        );
    }

    // Record this guardian's vote.
    let config = &mut ctx.accounts.guardian_config;
    let vote_idx = config.pending_votes as usize;
    config.voters[vote_idx] = guardian_key;
    config.pending_votes = config
        .pending_votes
        .checked_add(1)
        .ok_or(TestamentError::ArithmeticOverflow)?;

    msg!(
        "Guardian {} voted ({}/{})",
        guardian_key,
        config.pending_votes,
        GUARDIAN_QUORUM,
    );

    // Quorum reached: reset vault heartbeat and cancel any active countdown.
    if config.pending_votes as usize >= GUARDIAN_QUORUM {
        let vault = &mut ctx.accounts.vault;

        if vault.countdown_active() {
            vault.countdown_started_at = 0;
            msg!("Guardian quorum — countdown cancelled");
        }

        vault.last_heartbeat = now;
        config.clear_votes();

        msg!("Guardian quorum — heartbeat reset to {}", now);
    }

    Ok(())
}
