/**
 * passkey.ts — WebAuthn / Passkey helpers for Testament
 *
 * Passkeys are P-256 (secp256r1) keypairs stored in the device's secure enclave.
 * The private key never leaves the chip; signing requires biometric authentication.
 *
 * Flow:
 *   1. register()  — creates a new passkey tied to the vault owner's wallet.
 *                    Returns the compressed 33-byte P-256 public key to store on-chain.
 *   2. sign()      — prompts biometric auth, signs the supplied challenge.
 *                    Returns the 64-byte raw (r || s) signature for the secp256r1 tx ix.
 *   3. extractPubkey() — parses the attestation response to get the raw P-256 public key.
 */

/** Compressed P-256 public key (33 bytes). */
export type CompressedP256Pubkey = Uint8Array; // length 33

/** Raw P-256 signature (64 bytes = r || s). */
export type P256Signature = Uint8Array; // length 64

// ── CBOR minimal decoder ─────────────────────────────────────────────────────
// We only need to decode a COSE_Key map from an attestation statement.
// Full CBOR library would be nicer but this avoids a dependency.

function decodeCborMap(data: Uint8Array): Map<number, unknown> {
  // Very minimal CBOR map decoder — only handles the structure produced by
  // WebAuthn attestation (major type 5 = map, integer keys, byte-string values).
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  function readByte(): number {
    return view.getUint8(offset++);
  }

  function readUint(): number {
    const b = readByte();
    const major = b >> 5;
    const info = b & 0x1f;
    if (major !== 0 && major !== 1) throw new Error("Unexpected CBOR major type " + major);
    if (info < 24) return major === 1 ? -1 - info : info;
    if (info === 24) return major === 1 ? -1 - readByte() : readByte();
    if (info === 25) {
      const v = view.getUint16(offset, false); offset += 2;
      return major === 1 ? -1 - v : v;
    }
    throw new Error("Unsupported CBOR uint size " + info);
  }

  function readBytes(): Uint8Array {
    const b = readByte();
    const major = b >> 5;
    const info = b & 0x1f;
    if (major !== 2) throw new Error("Expected byte string, got major " + major);
    let len: number;
    if (info < 24) len = info;
    else if (info === 24) len = readByte();
    else if (info === 25) { len = view.getUint16(offset, false); offset += 2; }
    else throw new Error("Unsupported byte string length " + info);
    const result = data.slice(offset, offset + len);
    offset += len;
    return result;
  }

  const firstByte = readByte();
  const major = firstByte >> 5;
  const info = firstByte & 0x1f;
  if (major !== 5) throw new Error("Expected CBOR map");
  let count: number;
  if (info < 24) count = info;
  else if (info === 24) count = readByte();
  else throw new Error("Map too large");

  const map = new Map<number, unknown>();
  for (let i = 0; i < count; i++) {
    const key = readUint();
    const valByte = view.getUint8(offset);
    const valMajor = valByte >> 5;
    if (valMajor === 2) {
      map.set(key, readBytes());
    } else {
      map.set(key, readUint());
    }
  }
  return map;
}

/**
 * Extract the compressed 33-byte P-256 public key from a WebAuthn
 * attestation response.
 *
 * The authenticator returns a COSE_Key map in the authData:
 *   -2 → x (32 bytes)
 *   -3 → y (32 bytes)
 * We compress: prefix 02 if y is even, 03 if odd, then x.
 */
export function extractPubkeyFromAttestation(
  response: AuthenticatorAttestationResponse
): CompressedP256Pubkey {
  // authData layout: rpIdHash(32) | flags(1) | signCount(4) | attestedCredData...
  const authData = new Uint8Array(response.getAuthenticatorData());

  // Skip: rpIdHash(32) + flags(1) + signCount(4) + aaguid(16) + credIdLen(2)
  const credIdLen = (authData[53] << 8) | authData[54];
  const coseOffset = 55 + credIdLen;

  const coseKey = decodeCborMap(authData.slice(coseOffset));

  const x = coseKey.get(-2) as Uint8Array;
  const y = coseKey.get(-3) as Uint8Array;

  if (!x || !y || x.length !== 32 || y.length !== 32) {
    throw new Error("Could not extract P-256 coordinates from attestation");
  }

  // Compress: 02 = even y, 03 = odd y
  const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03;
  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(x, 1);
  return compressed;
}

/**
 * Register a new passkey for a vault owner.
 *
 * @param walletPubkeyBytes  32-byte owner wallet public key (used as WebAuthn user.id)
 * @param vaultAddress       Base58 vault address (used as display name)
 * @returns compressed 33-byte P-256 public key + credential ID for later signing
 */
export async function registerPasskey(
  walletPubkeyBytes: Uint8Array,
  vaultAddress: string
): Promise<{ pubkey: CompressedP256Pubkey; credentialId: Uint8Array }> {
  const challengeBytes = new Uint8Array(32);
  crypto.getRandomValues(challengeBytes);
  const challenge: ArrayBuffer = challengeBytes.buffer.slice(0) as ArrayBuffer;

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: "Testament",
        id: window.location.hostname,
      },
      user: {
        id: walletPubkeyBytes.buffer.slice(0) as ArrayBuffer,
        name: vaultAddress,
        displayName: "Testament Vault Owner",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256 = P-256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform", // device biometric only
        userVerification: "required",        // biometric mandatory
        residentKey: "required",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("Passkey registration was cancelled.");

  const response = credential.response as AuthenticatorAttestationResponse;
  const pubkey = extractPubkeyFromAttestation(response);

  return {
    pubkey,
    credentialId: new Uint8Array(credential.rawId),
  };
}

/**
 * Sign a challenge with a previously registered passkey.
 * Triggers the device biometric prompt (Face ID / Touch ID / fingerprint).
 *
 * @param challenge       32-byte challenge (e.g. sha256(vault || blockhash))
 * @param credentialId    The credential ID from registration
 * @returns 64-byte raw (r || s) DER-decoded signature
 */
export async function signWithPasskey(
  challenge: Uint8Array,
  credentialId: Uint8Array
): Promise<P256Signature> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge.buffer as ArrayBuffer,
      rpId: window.location.hostname,
      userVerification: "required",
      allowCredentials: [
        {
          type: "public-key",
          id: credentialId.buffer as ArrayBuffer,
        },
      ],
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("Passkey signing was cancelled.");

  const response = assertion.response as AuthenticatorAssertionResponse;
  const derSig = new Uint8Array(response.signature);

  return derToRawSig(derSig);
}

/**
 * Convert a DER-encoded ECDSA signature to raw 64-byte (r || s) format.
 * WebAuthn returns DER; the secp256r1 Solana program expects raw.
 */
function derToRawSig(der: Uint8Array): P256Signature {
  // DER: 30 len 02 rLen r... 02 sLen s...
  if (der[0] !== 0x30) throw new Error("Not a DER sequence");
  let offset = 2; // skip 30 + total-len

  if (der[offset] !== 0x02) throw new Error("Expected INTEGER for r");
  offset++;
  const rLen = der[offset++];
  // Strip leading 0x00 padding
  const rStart = der[offset] === 0x00 ? offset + 1 : offset;
  const r = der.slice(rStart, offset + rLen);
  offset += rLen;

  if (der[offset] !== 0x02) throw new Error("Expected INTEGER for s");
  offset++;
  const sLen = der[offset++];
  const sStart = der[offset] === 0x00 ? offset + 1 : offset;
  const s = der.slice(sStart, offset + sLen);

  const raw = new Uint8Array(64);
  raw.set(r.slice(-32), 0);
  raw.set(s.slice(-32), 32);
  return raw;
}

/**
 * Build the challenge bytes for a heartbeat secp256r1 verify instruction.
 * Message = sha256(vault_pubkey_bytes || recent_blockhash_bytes)
 */
export async function buildHeartbeatChallenge(
  vaultPubkeyBytes: Uint8Array,
  recentBlockhashBytes: Uint8Array
): Promise<Uint8Array> {
  const combined = new Uint8Array(64);
  combined.set(vaultPubkeyBytes, 0);
  combined.set(recentBlockhashBytes, 32);
  const hash = await crypto.subtle.digest("SHA-256", combined.buffer as ArrayBuffer);
  return new Uint8Array(hash);
}
