use anchor_lang::prelude::*;

use crate::{
    errors::TestamentError,
    state::{
        vault::{MIN_COUNTDOWN_DURATION, MIN_HEARTBEAT_INTERVAL},
        Vault,
    },
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateVaultArgs {
    /// Seconds between required owner check-ins. Min: 3600 (1 hour).
    pub heartbeat_interval: i64,
    /// Seconds the countdown runs before beneficiaries can claim. Min: 86400 (1 day).
    pub countdown_duration: i64,
    /// Seconds the owner can dispute a false activation. Must be < countdown_duration.
    pub dispute_window: i64,
    /// SHA-256 hash of the encrypted off-chain message. Pass [0u8; 32] for no message.
    pub message_hash: [u8; 32],
}

#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(
        init,
        payer = owner,
        space = Vault::LEN,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateVault>, args: CreateVaultArgs) -> Result<()> {
    require!(
        args.heartbeat_interval >= MIN_HEARTBEAT_INTERVAL,
        TestamentError::InvalidHeartbeatInterval
    );
    require!(
        args.countdown_duration >= MIN_COUNTDOWN_DURATION,
        TestamentError::InvalidCountdownDuration
    );
    require!(
        args.dispute_window < args.countdown_duration,
        TestamentError::InvalidDisputeWindow
    );

    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;

    vault.owner = ctx.accounts.owner.key();
    vault.heartbeat_interval = args.heartbeat_interval;
    vault.last_heartbeat = now;
    vault.countdown_duration = args.countdown_duration;
    vault.countdown_started_at = 0;
    vault.dispute_window = args.dispute_window;
    vault.beneficiary_count = 0;
    vault.total_shares_bps = 0;
    vault.is_locked = false;
    vault.is_active = true;
    vault.message_hash = args.message_hash;
    vault.bump = ctx.bumps.vault;

    msg!(
        "Vault created: {} | interval: {}s | countdown: {}s | dispute: {}s",
        vault.key(),
        args.heartbeat_interval,
        args.countdown_duration,
        args.dispute_window,
    );

    Ok(())
}
