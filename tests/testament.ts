import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Testament } from "../target/types/testament";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { startAnchor, Clock } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { assert } from "chai";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function vaultPda(owner: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer()],
    programId
  );
}

function beneficiaryPda(vault: PublicKey, wallet: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("beneficiary"), vault.toBuffer(), wallet.toBuffer()],
    programId
  );
}

// Minimum valid intervals (program enforces MIN_HEARTBEAT_INTERVAL=3600, MIN_COUNTDOWN_DURATION=86400)
// bankrun warp makes these instant in tests
const HEARTBEAT_INTERVAL = new BN(3_600);   // 1 hour
const COUNTDOWN_DURATION = new BN(86_400);  // 1 day
const DISPUTE_WINDOW     = new BN(3_000);   // 50 minutes (must be < countdown_duration)

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("testament (bankrun)", () => {
  let context: Awaited<ReturnType<typeof startAnchor>>;
  let provider: BankrunProvider;
  let program: Program<Testament>;

  let owner: Keypair;
  let alice: Keypair;
  let bob: Keypair;

  before(async () => {
    owner = Keypair.generate();
    alice = Keypair.generate();
    bob   = Keypair.generate();

    // Start a local bankrun context — no real network, instant, deterministic
    context = await startAnchor(
      ".",
      [],
      [
        { address: owner.publicKey, info: { lamports: 10 * LAMPORTS_PER_SOL, data: Buffer.alloc(0), owner: SystemProgram.programId, executable: false } },
        { address: alice.publicKey, info: { lamports: 2 * LAMPORTS_PER_SOL,  data: Buffer.alloc(0), owner: SystemProgram.programId, executable: false } },
        { address: bob.publicKey,   info: { lamports: 2 * LAMPORTS_PER_SOL,  data: Buffer.alloc(0), owner: SystemProgram.programId, executable: false } },
      ]
    );

    provider = new BankrunProvider(context, new anchor.Wallet(owner));
    anchor.setProvider(provider);
    program = anchor.workspace.Testament as Program<Testament>;
  });

  // Helper: advance the bankrun clock by `seconds` from current unix_timestamp
  async function advanceTime(seconds: number) {
    const clock = await context.banksClient.getClock();
    context.setClock(
      new Clock(
        clock.slot,
        clock.epochStartTimestamp,
        clock.epoch,
        clock.leaderScheduleEpoch,
        clock.unixTimestamp + BigInt(seconds)
      )
    );
  }

  // -------------------------------------------------------------------------
  it("creates a vault", async () => {
    const [vault] = vaultPda(owner.publicKey, program.programId);

    await program.methods
      .createVault({
        heartbeatInterval: HEARTBEAT_INTERVAL,
        countdownDuration: COUNTDOWN_DURATION,
        disputeWindow: DISPUTE_WINDOW,
        messageHash: Array(32).fill(0),
      })
      .accounts({ vault, owner: owner.publicKey, systemProgram: SystemProgram.programId })
      .signers([owner])
      .rpc();

    const v = await program.account.vault.fetch(vault);
    assert.equal(v.owner.toBase58(), owner.publicKey.toBase58());
    assert.equal(v.isLocked, false);
    assert.equal(v.isActive, true);
    assert.equal(v.beneficiaryCount, 0);
  });

  // -------------------------------------------------------------------------
  it("adds two beneficiaries (alice 70%, bob 30%)", async () => {
    const [vault] = vaultPda(owner.publicKey, program.programId);
    const [alicePda] = beneficiaryPda(vault, alice.publicKey, program.programId);
    const [bobPda]   = beneficiaryPda(vault, bob.publicKey, program.programId);

    await program.methods.addBeneficiary({ shareBps: 7000 })
      .accounts({ vault, beneficiaryWallet: alice.publicKey, beneficiary: alicePda, owner: owner.publicKey, systemProgram: SystemProgram.programId })
      .signers([owner]).rpc();

    await program.methods.addBeneficiary({ shareBps: 3000 })
      .accounts({ vault, beneficiaryWallet: bob.publicKey, beneficiary: bobPda, owner: owner.publicKey, systemProgram: SystemProgram.programId })
      .signers([owner]).rpc();

    const v = await program.account.vault.fetch(vault);
    assert.equal(v.beneficiaryCount, 2);
    assert.equal(v.totalSharesBps, 10000);
  });

  // -------------------------------------------------------------------------
  it("rejects a beneficiary that would overflow 10000 bps", async () => {
    const [vault] = vaultPda(owner.publicKey, program.programId);
    const extra = Keypair.generate();
    const [extraPda] = beneficiaryPda(vault, extra.publicKey, program.programId);

    try {
      await program.methods.addBeneficiary({ shareBps: 1 })
        .accounts({ vault, beneficiaryWallet: extra.publicKey, beneficiary: extraPda, owner: owner.publicKey, systemProgram: SystemProgram.programId })
        .signers([owner]).rpc();
      assert.fail("Should throw SharesOverflow");
    } catch (err: any) {
      assert.include(err.message, "SharesOverflow");
    }
  });

  // -------------------------------------------------------------------------
  it("locks the vault", async () => {
    const [vault] = vaultPda(owner.publicKey, program.programId);
    await program.methods.lockVault().accounts({ vault, owner: owner.publicKey }).signers([owner]).rpc();
    const v = await program.account.vault.fetch(vault);
    assert.equal(v.isLocked, true);
  });

  // -------------------------------------------------------------------------
  it("deposits SOL into the vault", async () => {
    const [vault] = vaultPda(owner.publicKey, program.programId);
    const before = await context.banksClient.getBalance(vault);
    await program.methods.deposit({ amount: new BN(2 * LAMPORTS_PER_SOL) })
      .accounts({ vault, owner: owner.publicKey, systemProgram: SystemProgram.programId })
      .signers([owner]).rpc();
    const after = await context.banksClient.getBalance(vault);
    assert.isAbove(Number(after), Number(before));
  });

  // -------------------------------------------------------------------------
  it("records a heartbeat", async () => {
    const [vault] = vaultPda(owner.publicKey, program.programId);
    const before = await program.account.vault.fetch(vault);

    // Advance time by 30 seconds so timestamp is distinguishably newer
    await advanceTime(30);

    await program.methods.heartbeat().accounts({ vault, owner: owner.publicKey }).signers([owner]).rpc();
    const after = await program.account.vault.fetch(vault);
    assert.isAbove(after.lastHeartbeat.toNumber(), before.lastHeartbeat.toNumber());
  });

  // -------------------------------------------------------------------------
  it("rejects trigger_countdown before heartbeat_interval elapses", async () => {
    const [vault] = vaultPda(owner.publicKey, program.programId);
    const caller = Keypair.generate();
    try {
      await program.methods.triggerCountdown()
        .accounts({ vault, caller: caller.publicKey }).signers([caller]).rpc();
      assert.fail("Should throw HeartbeatNotElapsed");
    } catch (err: any) {
      assert.include(err.message, "HeartbeatNotElapsed");
    }
  });

  // -------------------------------------------------------------------------
  it("triggers countdown after heartbeat interval elapses", async () => {
    const [vault] = vaultPda(owner.publicKey, program.programId);
    const caller = Keypair.generate();

    // Advance clock past the heartbeat_interval (1 hour)
    await advanceTime(3700);

    await program.methods.triggerCountdown()
      .accounts({ vault, caller: caller.publicKey }).signers([caller]).rpc();

    const v = await program.account.vault.fetch(vault);
    assert.isAbove(v.countdownStartedAt.toNumber(), 0);
  });

  // -------------------------------------------------------------------------
  it("allows owner to dispute within the dispute window", async () => {
    const [vault] = vaultPda(owner.publicKey, program.programId);
    await program.methods.dispute().accounts({ vault, owner: owner.publicKey }).signers([owner]).rpc();
    const v = await program.account.vault.fetch(vault);
    assert.equal(v.countdownStartedAt.toNumber(), 0);
  });

  // -------------------------------------------------------------------------
  it("full claim flow: trigger → warp past countdown → alice + bob claim", async () => {
    const [vault] = vaultPda(owner.publicKey, program.programId);
    const [alicePda] = beneficiaryPda(vault, alice.publicKey, program.programId);
    const [bobPda]   = beneficiaryPda(vault, bob.publicKey, program.programId);
    const caller = Keypair.generate();

    // Advance past heartbeat_interval again (owner didn't re-heartbeat after dispute)
    await advanceTime(3700);

    // Trigger countdown
    await program.methods.triggerCountdown()
      .accounts({ vault, caller: caller.publicKey }).signers([caller]).rpc();

    // Advance past countdown_duration (1 day)
    await advanceTime(86500);

    // Switch wallet to alice for her claim
    provider.wallet = new anchor.Wallet(alice);

    // Alice claims
    const aliceBefore = await context.banksClient.getBalance(alice.publicKey);
    await program.methods.claim()
      .accounts({ vault, beneficiary: alicePda, beneficiarySigner: alice.publicKey, systemProgram: SystemProgram.programId })
      .signers([alice]).rpc();
    const aliceAfter = await context.banksClient.getBalance(alice.publicKey);
    assert.isAbove(Number(aliceAfter), Number(aliceBefore), "Alice should receive funds");

    // Switch wallet to bob
    provider.wallet = new anchor.Wallet(bob);

    // Bob claims
    const bobBefore = await context.banksClient.getBalance(bob.publicKey);
    await program.methods.claim()
      .accounts({ vault, beneficiary: bobPda, beneficiarySigner: bob.publicKey, systemProgram: SystemProgram.programId })
      .signers([bob]).rpc();
    const bobAfter = await context.banksClient.getBalance(bob.publicKey);
    assert.isAbove(Number(bobAfter), Number(bobBefore), "Bob should receive funds");

    // Verify flags
    const a = await program.account.beneficiary.fetch(alicePda);
    const b = await program.account.beneficiary.fetch(bobPda);
    assert.equal(a.hasClaimed, true);
    assert.equal(b.hasClaimed, true);
  });

  // -------------------------------------------------------------------------
  it("rejects a double-claim", async () => {
    const [vault] = vaultPda(owner.publicKey, program.programId);
    const [alicePda] = beneficiaryPda(vault, alice.publicKey, program.programId);

    // alice wallet is still set from previous test
    provider.wallet = new anchor.Wallet(alice);

    try {
      await program.methods.claim()
        .accounts({ vault, beneficiary: alicePda, beneficiarySigner: alice.publicKey, systemProgram: SystemProgram.programId })
        .signers([alice]).rpc();
      assert.fail("Should throw AlreadyClaimed");
    } catch (err: any) {
      assert.include(err.message, "AlreadyClaimed");
    }
  });
});
