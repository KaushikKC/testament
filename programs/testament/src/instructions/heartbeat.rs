use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::sysvar::instructions::{
    self as ix_sysvar, load_instruction_at_checked,
};
use solana_program::pubkey;

use crate::{errors::TestamentError, state::Vault};

/// Native secp256r1 program ID (SIMD-0075).
pub const SECP256R1_PROGRAM_ID: Pubkey = pubkey!("Secp256r1SigVerify1111111111111111111111111");

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

    /// Instructions sysvar — only inspected when vault.passkey_required == true.
    /// CHECK: verified via the sysvar ID.
    #[account(address = ix_sysvar::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<Heartbeat>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;

    // ── Passkey verification (Phase 4) ──
    if vault.passkey_required {
        let instructions_sysvar = &ctx.accounts.instructions_sysvar;
        let current_ix_index =
            ix_sysvar::load_current_index_checked(instructions_sysvar)? as usize;
        require!(
            current_ix_index > 0,
            TestamentError::MissingSecp256r1Instruction
        );

        let verify_ix: Instruction =
            load_instruction_at_checked(current_ix_index - 1, instructions_sysvar)?;

        require!(
            verify_ix.program_id == SECP256R1_PROGRAM_ID,
            TestamentError::MissingSecp256r1Instruction
        );

        // Extract the pubkey from the secp256r1 instruction data.
        // Layout: 15 bytes header + 64 bytes signature + 33 bytes pubkey
        let data = &verify_ix.data;
        require!(
            data.len() >= 79 + 33,
            TestamentError::PasskeyVerificationFailed
        );
        let pubkey_in_ix = &data[79..79 + 33];
        require!(
            pubkey_in_ix == vault.passkey_pubkey,
            TestamentError::Secp256r1PubkeyMismatch
        );
    }

    // ── Countdown cancellation ──
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
