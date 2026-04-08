use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::sysvar::instructions::{
    self as ix_sysvar, load_instruction_at_checked,
};
use solana_program::pubkey;

use crate::{
    errors::TestamentError,
    state::{Vault, VaultAlias},
};

/// Native secp256r1 program ID (SIMD-0075).
pub const SECP256R1_PROGRAM_ID: Pubkey = pubkey!("Secp256r1SigVerify1111111111111111111111111");

#[derive(Accounts)]
pub struct RecoverWithPasskey<'info> {
    #[account(
        mut,
        constraint = vault.is_active @ TestamentError::VaultNotActive,
        constraint = vault.passkey_required @ TestamentError::NoPasskeyRegistered,
    )]
    pub vault: Account<'info, Vault>,

    /// The new Solana wallet that will become the vault owner (pays for alias PDA rent).
    #[account(mut)]
    pub new_owner: Signer<'info>,

    /// Alias PDA: seeds = ["vault_alias", new_owner].
    #[account(
        init,
        payer = new_owner,
        space = VaultAlias::LEN,
        seeds = [b"vault_alias", new_owner.key().as_ref()],
        bump,
    )]
    pub vault_alias: Account<'info, VaultAlias>,

    /// Instructions sysvar — used to inspect the secp256r1 verify ix.
    /// CHECK: verified via the sysvar ID constraint.
    #[account(address = ix_sysvar::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RecoverWithPasskey>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let instructions_sysvar = &ctx.accounts.instructions_sysvar;

    // ── Verify that ix[current - 1] is a secp256r1 verify instruction ──
    // The client must place the secp256r1 verify ix immediately before this one.
    let current_ix_index = ix_sysvar::load_current_index_checked(instructions_sysvar)? as usize;
    require!(current_ix_index > 0, TestamentError::MissingSecp256r1Instruction);

    let verify_ix: Instruction =
        load_instruction_at_checked(current_ix_index - 1, instructions_sysvar)?;

    require!(
        verify_ix.program_id == SECP256R1_PROGRAM_ID,
        TestamentError::MissingSecp256r1Instruction
    );

    // The secp256r1 instruction data layout (SIMD-0075):
    // [0]       num_signatures (u8)
    // [1..2]    signature_offset (u16 LE)
    // [3..4]    signature_instruction_index (u16 LE)
    // [5..6]    public_key_offset (u16 LE)
    // [7..8]    public_key_instruction_index (u16 LE)
    // [9..10]   message_data_offset (u16 LE)
    // [11..12]  message_data_size (u16 LE)
    // [13..14]  message_instruction_index (u16 LE)
    // [15..]    data (signature || pubkey || message)
    //
    // The pubkey starts at offset 15 + 64 (signature bytes) = 79.
    let data = &verify_ix.data;
    require!(data.len() >= 79 + 33, TestamentError::MissingSecp256r1Instruction);

    let pubkey_in_ix = &data[79..79 + 33];
    require!(
        pubkey_in_ix == vault.passkey_pubkey,
        TestamentError::Secp256r1PubkeyMismatch
    );

    // ── Transfer ownership ──
    let vault = &mut ctx.accounts.vault;
    vault.owner = ctx.accounts.new_owner.key();

    // Create alias PDA
    let alias = &mut ctx.accounts.vault_alias;
    alias.vault = vault.key();
    alias.bump = ctx.bumps.vault_alias;

    msg!(
        "Passkey recovery successful. Vault {} ownership transferred to {}.",
        vault.key(),
        vault.owner
    );

    Ok(())
}
