use anchor_lang::prelude::*;

use crate::{errors::TestamentError, state::Vault};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterPasskeyArgs {
    /// Compressed P-256 (secp256r1) public key — 33 bytes.
    pub passkey_pubkey: [u8; 33],
}

#[derive(Accounts)]
pub struct RegisterPasskey<'info> {
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

pub fn handler(ctx: Context<RegisterPasskey>, args: RegisterPasskeyArgs) -> Result<()> {
    // Reject all-zero pubkey — it's the sentinel for "no passkey".
    require!(
        args.passkey_pubkey != [0u8; 33],
        TestamentError::InvalidPasskeyPubkey
    );

    let vault = &mut ctx.accounts.vault;
    vault.passkey_pubkey = args.passkey_pubkey;
    vault.passkey_required = true;

    msg!(
        "Passkey registered for vault {}. Biometric check-ins now required.",
        vault.key()
    );

    Ok(())
}
