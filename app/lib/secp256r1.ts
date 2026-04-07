/**
 * secp256r1.ts — Build a secp256r1 signature verification instruction for Solana.
 *
 * Solana's native secp256r1 precompile (SIMD-0075) verifies P-256 signatures
 * on-chain. We place this instruction immediately BEFORE the heartbeat / recover
 * instruction in the same transaction.
 *
 * Instruction data layout (per SIMD-0075):
 *   [0]       num_signatures (u8)
 *   [1..2]    signature_offset (u16 LE)       — byte offset of sig in data
 *   [3..4]    signature_instruction_index (u16 LE)  — 0xFFFF = this ix
 *   [5..6]    public_key_offset (u16 LE)      — byte offset of pubkey in data
 *   [7..8]    public_key_instruction_index (u16 LE) — 0xFFFF = this ix
 *   [9..10]   message_data_offset (u16 LE)    — byte offset of message in data
 *   [11..12]  message_data_size (u16 LE)
 *   [13..14]  message_instruction_index (u16 LE)    — 0xFFFF = this ix
 *   [15..]    signature (64 bytes) || pubkey (33 bytes) || message (variable)
 */

import { PublicKey, TransactionInstruction } from "@solana/web3.js";

/** The native secp256r1 verify program ID. */
export const SECP256R1_PROGRAM_ID = new PublicKey(
  "Secp256r1SigVerify1111111111111111111111111"
);

const HEADER_SIZE = 15; // 1 + 14 bytes of offsets
const SIG_SIZE = 64;
const PUBKEY_SIZE = 33;

/**
 * Build a secp256r1 signature verify instruction.
 *
 * @param signature    64-byte raw (r || s) P-256 signature
 * @param pubkey       33-byte compressed P-256 public key
 * @param message      The message that was signed (arbitrary bytes)
 * @returns            A TransactionInstruction for the secp256r1 program
 */
export function buildSecp256r1Instruction(
  signature: Uint8Array,
  pubkey: Uint8Array,
  message: Uint8Array
): TransactionInstruction {
  if (signature.length !== SIG_SIZE) {
    throw new Error(`Signature must be ${SIG_SIZE} bytes, got ${signature.length}`);
  }
  if (pubkey.length !== PUBKEY_SIZE) {
    throw new Error(`Public key must be ${PUBKEY_SIZE} bytes, got ${pubkey.length}`);
  }

  const sigOffset = HEADER_SIZE;
  const pubkeyOffset = sigOffset + SIG_SIZE;
  const msgOffset = pubkeyOffset + PUBKEY_SIZE;
  const msgSize = message.length;

  const totalLen = msgOffset + msgSize;
  const data = new Uint8Array(totalLen);
  const view = new DataView(data.buffer);

  // num_signatures
  data[0] = 1;

  // signature_offset (u16 LE)
  view.setUint16(1, sigOffset, true);
  // signature_instruction_index (0xFFFF = current ix)
  view.setUint16(3, 0xffff, true);

  // public_key_offset (u16 LE)
  view.setUint16(5, pubkeyOffset, true);
  // public_key_instruction_index
  view.setUint16(7, 0xffff, true);

  // message_data_offset (u16 LE)
  view.setUint16(9, msgOffset, true);
  // message_data_size (u16 LE)
  view.setUint16(11, msgSize, true);
  // message_instruction_index
  view.setUint16(13, 0xffff, true);

  // Payload
  data.set(signature, sigOffset);
  data.set(pubkey, pubkeyOffset);
  data.set(message, msgOffset);

  return new TransactionInstruction({
    programId: SECP256R1_PROGRAM_ID,
    keys: [],
    data: Buffer.from(data),
  });
}
