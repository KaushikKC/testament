/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/testament.json`.
 */
export type Testament = {
  "address": "2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc",
  "metadata": {
    "name": "testament",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "addBeneficiary",
      "docs": [
        "Add a beneficiary to the vault.",
        "Vault must be unlocked. Shares must not exceed 10,000 bps total."
      ],
      "discriminator": [
        105,
        214,
        106,
        141,
        180,
        166,
        123,
        238
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "beneficiaryWallet"
        },
        {
          "name": "beneficiary",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  110,
                  101,
                  102,
                  105,
                  99,
                  105,
                  97,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "beneficiaryWallet"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "addBeneficiaryArgs"
            }
          }
        }
      ]
    },
    {
      "name": "addGuardian",
      "docs": [
        "Register a guardian wallet (max 3 per vault).",
        "Only the owner can add guardians. Cannot be called during an active countdown."
      ],
      "discriminator": [
        167,
        189,
        170,
        27,
        74,
        240,
        201,
        241
      ],
      "accounts": [
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "guardianConfig",
          "docs": [
            "GuardianConfig PDA — created on the first add_guardian call, reused thereafter."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  117,
                  97,
                  114,
                  100,
                  105,
                  97,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "guardianWallet",
          "docs": [
            "The wallet to register as a guardian. Does not need to sign."
          ]
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closeVault",
      "docs": [
        "Owner closes the vault and reclaims all lamports.",
        "Cannot be called while a countdown is active."
      ],
      "discriminator": [
        141,
        103,
        17,
        126,
        72,
        75,
        29,
        29
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createVault",
      "docs": [
        "Create a new inheritance vault.",
        "Sets heartbeat interval, countdown duration, dispute window, and optional message hash.",
        "Vault starts unlocked so beneficiaries can be added."
      ],
      "discriminator": [
        29,
        237,
        247,
        208,
        193,
        82,
        54,
        135
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "createVaultArgs"
            }
          }
        }
      ]
    },
    {
      "name": "dispute",
      "docs": [
        "Owner disputes a false activation within the dispute window.",
        "Resets the countdown and refreshes the heartbeat timestamp."
      ],
      "discriminator": [
        216,
        92,
        128,
        146,
        202,
        85,
        135,
        73
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "executeInheritance",
      "docs": [
        "Beneficiary claims their proportional share of a delegated SPL token.",
        "Only callable after countdown_duration has elapsed since trigger.",
        "Tokens transfer directly from the owner's wallet to the beneficiary."
      ],
      "discriminator": [
        108,
        112,
        129,
        171,
        5,
        244,
        41,
        106
      ],
      "accounts": [
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          },
          "relations": [
            "delegationRecord",
            "beneficiary"
          ]
        },
        {
          "name": "delegationRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "ownerTokenAccount",
          "docs": [
            "The vault owner's token account — still in their wallet, never moved."
          ],
          "writable": true
        },
        {
          "name": "beneficiary",
          "docs": [
            "Beneficiary PDA — seeded by [beneficiary, vault, beneficiary_wallet]."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  110,
                  101,
                  102,
                  105,
                  99,
                  105,
                  97,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "beneficiaryWallet"
              }
            ]
          }
        },
        {
          "name": "beneficiaryAta",
          "docs": [
            "Beneficiary's ATA for this mint (destination) — created if absent.",
            "Payer is the caller (keeper), not the beneficiary."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "beneficiaryWallet"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "beneficiaryWallet",
          "docs": [
            "Destination wallet — must match beneficiary.wallet stored on-chain."
          ]
        },
        {
          "name": "caller",
          "docs": [
            "Fee payer — anyone can call this (keeper bot, relayer, anyone).",
            "They pay the tiny transaction fee and ATA creation rent if needed.",
            "Funds always go to beneficiary_wallet regardless of who the caller is."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "executeSolInheritance",
      "docs": [
        "Beneficiary claims their proportional share of the designated SOL.",
        "Only callable after countdown_duration has elapsed since trigger."
      ],
      "discriminator": [
        42,
        101,
        150,
        35,
        149,
        201,
        137,
        140
      ],
      "accounts": [
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          },
          "relations": [
            "solDelegation",
            "beneficiary"
          ]
        },
        {
          "name": "solDelegation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  95,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "beneficiary",
          "docs": [
            "Beneficiary PDA — seeded by [beneficiary, vault, beneficiary_wallet]."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  110,
                  101,
                  102,
                  105,
                  99,
                  105,
                  97,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "beneficiaryWallet"
              }
            ]
          }
        },
        {
          "name": "beneficiaryWallet",
          "docs": [
            "Destination wallet — must match beneficiary.wallet stored on-chain."
          ],
          "writable": true
        },
        {
          "name": "caller",
          "docs": [
            "Fee payer — anyone can call this (keeper bot, relayer, anyone).",
            "They pay the tiny transaction fee (~0.000005 SOL). Funds still go",
            "to beneficiary_wallet regardless of who the caller is."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "guardianHeartbeat",
      "docs": [
        "A registered guardian casts a liveness vote.",
        "When GUARDIAN_QUORUM (2) unique guardians vote, the vault heartbeat is reset",
        "and any active countdown is cancelled."
      ],
      "discriminator": [
        42,
        91,
        168,
        6,
        65,
        37,
        10,
        99
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "guardianConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  117,
                  97,
                  114,
                  100,
                  105,
                  97,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "guardian",
          "docs": [
            "A registered guardian signing the liveness vote."
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "heartbeat",
      "docs": [
        "Owner check-in — proves the owner is alive and resets the heartbeat timer.",
        "If passkey is registered, the transaction must include a secp256r1 verify",
        "instruction signed with the owner's biometric (Face ID / Touch ID).",
        "If called during an active countdown (within dispute window), cancels the countdown."
      ],
      "discriminator": [
        202,
        104,
        56,
        6,
        240,
        170,
        63,
        134
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "instructionsSysvar",
          "docs": [
            "Instructions sysvar — only inspected when vault.passkey_required == true."
          ],
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "lockVault",
      "docs": [
        "Lock the vault. Shares must total exactly 10,000 bps.",
        "After locking, no beneficiary changes are allowed."
      ],
      "discriminator": [
        88,
        219,
        122,
        115,
        28,
        236,
        222,
        117
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "recoverWithPasskey",
      "docs": [
        "Recover vault ownership using only a passkey biometric signature.",
        "The transaction must include a secp256r1 verify instruction (ix[n-1])",
        "signed over sha256(vault || new_owner || recent_blockhash) with the",
        "registered passkey. No guardian quorum needed — the biometric is proof enough."
      ],
      "discriminator": [
        138,
        246,
        94,
        222,
        73,
        119,
        134,
        105
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "newOwner",
          "docs": [
            "The new Solana wallet that will become the vault owner (pays for alias PDA rent)."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultAlias",
          "docs": [
            "Alias PDA: seeds = [\"vault_alias\", new_owner]."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  108,
                  105,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "newOwner"
              }
            ]
          }
        },
        {
          "name": "instructionsSysvar",
          "docs": [
            "Instructions sysvar — used to inspect the secp256r1 verify ix."
          ],
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "registerDelegation",
      "docs": [
        "Designate SPL tokens for inheritance without moving them from your wallet.",
        "Creates a DelegationRecord PDA and calls spl_token::approve so this program",
        "can transfer on your behalf only when the countdown conditions are met.",
        "Vault must be locked before delegations can be registered."
      ],
      "discriminator": [
        59,
        119,
        36,
        147,
        237,
        101,
        166,
        210
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "delegationRecord",
          "docs": [
            "One delegation record per (vault, mint) pair."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "ownerTokenAccount",
          "docs": [
            "Owner's ATA for this mint — the `approve` will be set on this account."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "registerDelegationArgs"
            }
          }
        }
      ]
    },
    {
      "name": "registerPasskey",
      "docs": [
        "Register a P-256 passkey public key for biometric heartbeat verification.",
        "Once set, every heartbeat must be accompanied by a secp256r1 signature",
        "produced by the owner's device biometric (Face ID / Touch ID)."
      ],
      "discriminator": [
        16,
        2,
        121,
        116,
        194,
        17,
        247,
        233
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "registerPasskeyArgs"
            }
          }
        }
      ]
    },
    {
      "name": "registerRecoveryWallet",
      "docs": [
        "Register a backup recovery wallet.",
        "If the owner ever loses their Solana keypair, this wallet (combined with",
        "guardian quorum) can authorise an ownership transfer."
      ],
      "discriminator": [
        93,
        19,
        9,
        235,
        215,
        171,
        214,
        156
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "recoveryWallet"
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "registerSolDelegation",
      "docs": [
        "Designate native SOL for inheritance.",
        "SOL is transferred into a SolDelegation PDA (cannot be SPL-delegated).",
        "The owner can revoke at any time via revoke_sol_delegation."
      ],
      "discriminator": [
        202,
        45,
        129,
        87,
        111,
        36,
        192,
        182
      ],
      "accounts": [
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "solDelegation",
          "docs": [
            "SOL delegation PDA — holds the lamports on behalf of the vault."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  95,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "registerSolDelegationArgs"
            }
          }
        }
      ]
    },
    {
      "name": "revokeDelegation",
      "docs": [
        "Revoke an SPL token delegation. Cancels the spl_token::approve and",
        "closes the DelegationRecord account, returning rent to the owner.",
        "Can be called at any time while the vault is active."
      ],
      "discriminator": [
        188,
        92,
        135,
        67,
        160,
        181,
        54,
        62
      ],
      "accounts": [
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          },
          "relations": [
            "delegationRecord"
          ]
        },
        {
          "name": "delegationRecord",
          "docs": [
            "Delegation record to close — returns rent to owner."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "ownerTokenAccount",
          "docs": [
            "Owner's ATA — the SPL approval will be revoked from this account."
          ],
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "revokeSolDelegation",
      "docs": [
        "Withdraw SOL from the SolDelegation PDA back to the owner's wallet.",
        "This is the safety valve — no lockup, fully revocable while alive."
      ],
      "discriminator": [
        35,
        187,
        108,
        91,
        44,
        235,
        23,
        65
      ],
      "accounts": [
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          },
          "relations": [
            "solDelegation"
          ]
        },
        {
          "name": "solDelegation",
          "docs": [
            "SolDelegation PDA — closed on revoke; lamports returned to owner."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  95,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "transferOwnership",
      "docs": [
        "Transfer vault ownership to a new wallet.",
        "Requires: (a) recovery_wallet signer matches vault.recovery_wallet,",
        "(b) guardian quorum has been reached.",
        "Creates a VaultAlias PDA so downstream instructions can still resolve",
        "the vault via the new owner key."
      ],
      "discriminator": [
        65,
        177,
        215,
        73,
        53,
        45,
        99,
        47
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "guardianConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  117,
                  97,
                  114,
                  100,
                  105,
                  97,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "recoveryWallet",
          "docs": [
            "The pre-registered recovery wallet — must be the signer (pays for alias PDA rent)."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "newOwnerWallet"
        },
        {
          "name": "vaultAlias",
          "docs": [
            "Alias PDA created at [b\"vault_alias\", new_owner_wallet]."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  108,
                  105,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "newOwnerWallet"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "triggerCountdown",
      "docs": [
        "Trigger the countdown after a missed check-in.",
        "Anyone can call this once the heartbeat interval has elapsed.",
        "Vault must be locked."
      ],
      "discriminator": [
        143,
        69,
        53,
        127,
        187,
        66,
        184,
        178
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "caller",
          "docs": [
            "Anyone can trigger — no signer restriction."
          ],
          "signer": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "beneficiary",
      "discriminator": [
        45,
        182,
        224,
        198,
        197,
        255,
        233,
        33
      ]
    },
    {
      "name": "delegationRecord",
      "discriminator": [
        203,
        185,
        161,
        226,
        129,
        251,
        132,
        155
      ]
    },
    {
      "name": "guardianConfig",
      "discriminator": [
        253,
        92,
        160,
        221,
        64,
        253,
        141,
        121
      ]
    },
    {
      "name": "solDelegation",
      "discriminator": [
        193,
        98,
        97,
        214,
        30,
        180,
        210,
        237
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    },
    {
      "name": "vaultAlias",
      "discriminator": [
        111,
        59,
        49,
        59,
        76,
        141,
        131,
        219
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "vaultNotActive",
      "msg": "Vault is not active"
    },
    {
      "code": 6001,
      "name": "vaultAlreadyLocked",
      "msg": "Vault is already locked and cannot be modified"
    },
    {
      "code": 6002,
      "name": "vaultNotLocked",
      "msg": "Vault must be locked before countdown can be triggered"
    },
    {
      "code": 6003,
      "name": "sharesNotComplete",
      "msg": "Vault shares must total exactly 10000 basis points (100%) before locking"
    },
    {
      "code": 6004,
      "name": "sharesOverflow",
      "msg": "Adding this beneficiary would exceed 10000 basis points total"
    },
    {
      "code": 6005,
      "name": "zeroShares",
      "msg": "Share amount must be greater than zero"
    },
    {
      "code": 6006,
      "name": "maxBeneficiariesReached",
      "msg": "Maximum of 10 beneficiaries allowed per vault"
    },
    {
      "code": 6007,
      "name": "heartbeatNotElapsed",
      "msg": "Heartbeat interval has not elapsed yet — owner is still active"
    },
    {
      "code": 6008,
      "name": "countdownAlreadyStarted",
      "msg": "Countdown has already been triggered"
    },
    {
      "code": 6009,
      "name": "countdownNotStarted",
      "msg": "Countdown has not been triggered yet"
    },
    {
      "code": 6010,
      "name": "disputeWindowNotElapsed",
      "msg": "Dispute window has not elapsed yet — countdown is still active"
    },
    {
      "code": 6011,
      "name": "disputeWindowElapsed",
      "msg": "Dispute window has already elapsed — vault cannot be disputed"
    },
    {
      "code": 6012,
      "name": "alreadyClaimed",
      "msg": "This beneficiary has already claimed their share"
    },
    {
      "code": 6013,
      "name": "insufficientVaultBalance",
      "msg": "Vault has insufficient lamports to fulfil claim"
    },
    {
      "code": 6014,
      "name": "unauthorizedOwner",
      "msg": "Only the vault owner can perform this action"
    },
    {
      "code": 6015,
      "name": "unauthorizedBeneficiary",
      "msg": "Beneficiary wallet does not match this beneficiary account"
    },
    {
      "code": 6016,
      "name": "invalidHeartbeatInterval",
      "msg": "Heartbeat interval must be at least 1 hour (3600 seconds)"
    },
    {
      "code": 6017,
      "name": "invalidCountdownDuration",
      "msg": "Countdown duration must be at least 1 day (86400 seconds)"
    },
    {
      "code": 6018,
      "name": "invalidDisputeWindow",
      "msg": "Dispute window must be less than countdown duration"
    },
    {
      "code": 6019,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6020,
      "name": "maxGuardiansReached",
      "msg": "Maximum of 3 guardians allowed per vault"
    },
    {
      "code": 6021,
      "name": "guardianAlreadyExists",
      "msg": "This wallet is already registered as a guardian"
    },
    {
      "code": 6022,
      "name": "notAGuardian",
      "msg": "Signer is not a registered guardian for this vault"
    },
    {
      "code": 6023,
      "name": "alreadyVoted",
      "msg": "This guardian has already voted in the current round"
    },
    {
      "code": 6024,
      "name": "noRecoveryWallet",
      "msg": "No recovery wallet is registered for this vault"
    },
    {
      "code": 6025,
      "name": "invalidRecoveryWallet",
      "msg": "Recovery wallet does not match the registered address"
    },
    {
      "code": 6026,
      "name": "guardianQuorumNotReached",
      "msg": "Guardian quorum has not been reached for this recovery"
    },
    {
      "code": 6027,
      "name": "passkeyVerificationFailed",
      "msg": "Passkey verification failed — biometric signature invalid"
    },
    {
      "code": 6028,
      "name": "invalidPasskeyPubkey",
      "msg": "Invalid passkey public key — must be 33-byte compressed P-256 point"
    },
    {
      "code": 6029,
      "name": "passkeyRequired",
      "msg": "Passkey is required for this vault's heartbeat"
    },
    {
      "code": 6030,
      "name": "noPasskeyRegistered",
      "msg": "No passkey registered for this vault"
    },
    {
      "code": 6031,
      "name": "missingSecp256r1Instruction",
      "msg": "secp256r1 verify instruction missing from transaction"
    },
    {
      "code": 6032,
      "name": "secp256r1PubkeyMismatch",
      "msg": "secp256r1 verify instruction references wrong public key"
    },
    {
      "code": 6033,
      "name": "delegationAmountZero",
      "msg": "Delegation amount must be greater than zero"
    },
    {
      "code": 6034,
      "name": "invalidDelegationAccount",
      "msg": "Delegation account does not match the registered token account"
    },
    {
      "code": 6035,
      "name": "noSolDelegation",
      "msg": "SOL delegation account not found for this vault"
    }
  ],
  "types": [
    {
      "name": "addBeneficiaryArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "shareBps",
            "docs": [
              "Share in basis points (out of 10_000). e.g. 5000 = 50%."
            ],
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "beneficiary",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "docs": [
              "The vault this beneficiary belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "wallet",
            "docs": [
              "The beneficiary's wallet address (receives the share)."
            ],
            "type": "pubkey"
          },
          {
            "name": "shareBps",
            "docs": [
              "Share in basis points (out of 10_000).",
              "e.g. 5_000 = 50%, 2_500 = 25%, 100 = 1%."
            ],
            "type": "u16"
          },
          {
            "name": "hasClaimed",
            "docs": [
              "Whether this beneficiary has already claimed their share."
            ],
            "type": "bool"
          },
          {
            "name": "index",
            "docs": [
              "Zero-indexed position (for PDA seed uniqueness if same wallet used twice — prevented by PDA)."
            ],
            "type": "u8"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "createVaultArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "heartbeatInterval",
            "docs": [
              "Seconds between required owner check-ins. Min: 3600 (1 hour)."
            ],
            "type": "i64"
          },
          {
            "name": "countdownDuration",
            "docs": [
              "Seconds the countdown runs before beneficiaries can claim. Min: 86400 (1 day)."
            ],
            "type": "i64"
          },
          {
            "name": "disputeWindow",
            "docs": [
              "Seconds the owner can dispute a false activation. Must be < countdown_duration."
            ],
            "type": "i64"
          },
          {
            "name": "messageHash",
            "docs": [
              "SHA-256 hash of the encrypted off-chain message. Pass [0u8; 32] for no message."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "delegationRecord",
      "docs": [
        "Records that the vault owner has approved this program (via PDA delegation)",
        "to transfer up to `approved_amount` of `token_mint` on their behalf.",
        "",
        "Seeds: [\"delegation\", vault, token_mint]",
        "",
        "The PDA address is the SPL delegate set via `spl_token::approve`.",
        "It can only sign within this program and only when the countdown conditions",
        "are satisfied in `execute_inheritance`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "docs": [
              "Parent vault."
            ],
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "docs": [
              "SPL mint being delegated."
            ],
            "type": "pubkey"
          },
          {
            "name": "ownerTokenAccount",
            "docs": [
              "Owner's ATA for this mint — the token account that was `approve`d."
            ],
            "type": "pubkey"
          },
          {
            "name": "approvedAmount",
            "docs": [
              "Amount approved via spl_token::approve."
            ],
            "type": "u64"
          },
          {
            "name": "claimedMask",
            "docs": [
              "Bitmask: bit i = beneficiary at index i has claimed this mint."
            ],
            "type": "u16"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "guardianConfig",
      "docs": [
        "Per-vault guardian configuration.",
        "",
        "PDA seeds: `[b\"guardian_config\", vault.key().as_ref()]`",
        "",
        "Stores up to 3 registered guardian wallets and tracks the current round",
        "of votes. When GUARDIAN_QUORUM (2) unique guardians vote, the vault",
        "heartbeat is reset and any active countdown is cancelled."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "docs": [
              "The vault this config belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "guardians",
            "docs": [
              "Registered guardian wallets (up to 3; Pubkey::default() padding)."
            ],
            "type": {
              "array": [
                "pubkey",
                3
              ]
            }
          },
          {
            "name": "count",
            "docs": [
              "Number of registered guardians (0–3)."
            ],
            "type": "u8"
          },
          {
            "name": "pendingVotes",
            "docs": [
              "How many unique votes have been cast in the current round."
            ],
            "type": "u8"
          },
          {
            "name": "voters",
            "docs": [
              "Which guardians have voted in the current round (zero-padded)."
            ],
            "type": {
              "array": [
                "pubkey",
                3
              ]
            }
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "registerDelegationArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "docs": [
              "How much of this token to designate for inheritance."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "registerPasskeyArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "passkeyPubkey",
            "docs": [
              "Compressed P-256 (secp256r1) public key — 33 bytes."
            ],
            "type": {
              "array": [
                "u8",
                33
              ]
            }
          }
        ]
      }
    },
    {
      "name": "registerSolDelegationArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "docs": [
              "Amount of SOL to designate, in lamports."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "solDelegation",
      "docs": [
        "Holds native SOL designated for inheritance.",
        "",
        "Unlike SPL tokens (which stay in the owner's wallet via delegation),",
        "native SOL cannot be delegated via the SPL token program, so it is",
        "temporarily held in this PDA. The owner can `revoke_sol_delegation`",
        "at any time to withdraw — it is NOT a lockup.",
        "",
        "Seeds: [\"sol_delegation\", vault]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "docs": [
              "Parent vault."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Total SOL held (lamports), excluding rent."
            ],
            "type": "u64"
          },
          {
            "name": "claimedMask",
            "docs": [
              "Bitmask: bit i = beneficiary at index i has claimed their share."
            ],
            "type": "u16"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "The wallet that owns this vault and must send regular heartbeats."
            ],
            "type": "pubkey"
          },
          {
            "name": "heartbeatInterval",
            "docs": [
              "How often (in seconds) the owner must check in.",
              "Default: 7_776_000 (90 days)."
            ],
            "type": "i64"
          },
          {
            "name": "lastHeartbeat",
            "docs": [
              "Unix timestamp of the last successful heartbeat."
            ],
            "type": "i64"
          },
          {
            "name": "countdownDuration",
            "docs": [
              "How long (in seconds) the dispute/countdown window lasts after",
              "a missed heartbeat is detected. Default: 1_209_600 (14 days)."
            ],
            "type": "i64"
          },
          {
            "name": "countdownStartedAt",
            "docs": [
              "Unix timestamp when the countdown was triggered.",
              "0 means no countdown is active."
            ],
            "type": "i64"
          },
          {
            "name": "disputeWindow",
            "docs": [
              "How long (in seconds) the owner has to dispute a false activation",
              "after countdown starts. Must be < countdown_duration.",
              "Default: 604_800 (7 days)."
            ],
            "type": "i64"
          },
          {
            "name": "beneficiaryCount",
            "docs": [
              "Number of beneficiaries registered."
            ],
            "type": "u8"
          },
          {
            "name": "totalSharesBps",
            "docs": [
              "Sum of all beneficiary share_bps. Must equal TOTAL_SHARES_BPS",
              "before the vault can be locked."
            ],
            "type": "u16"
          },
          {
            "name": "isLocked",
            "docs": [
              "Whether the vault has been locked (no more beneficiary changes)."
            ],
            "type": "bool"
          },
          {
            "name": "isActive",
            "docs": [
              "Whether the vault is active. Set to false after owner closes it."
            ],
            "type": "bool"
          },
          {
            "name": "messageHash",
            "docs": [
              "SHA-256 hash of the encrypted final message stored off-chain",
              "(Arweave / IPFS). Zero bytes = no message set."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          },
          {
            "name": "recoveryWallet",
            "docs": [
              "Optional pre-registered recovery wallet.",
              "If set, this wallet can co-sign a transfer_ownership instruction",
              "alongside guardian consensus.",
              "Pubkey::default() = not set."
            ],
            "type": "pubkey"
          },
          {
            "name": "hasRecoveryWallet",
            "docs": [
              "Whether a recovery wallet has been registered."
            ],
            "type": "bool"
          },
          {
            "name": "passkeyPubkey",
            "docs": [
              "Compressed P-256 public key from the owner's passkey (33 bytes).",
              "All-zero = no passkey registered."
            ],
            "type": {
              "array": [
                "u8",
                33
              ]
            }
          },
          {
            "name": "passkeyRequired",
            "docs": [
              "Whether passkey verification is required for heartbeat."
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "vaultAlias",
      "docs": [
        "A thin alias PDA created when vault ownership is transferred.",
        "Seeds: [\"vault_alias\", current_owner_pubkey]",
        "Points to the original vault PDA so all downstream instructions",
        "can still resolve the vault even after the owner key changes."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "docs": [
              "Address of the original vault PDA."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    }
  ]
};
