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
      "name": "claim",
      "docs": [
        "Beneficiary claims their share of the vault.",
        "Can only be called after the countdown_duration has elapsed since trigger."
      ],
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
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
                "path": "vault.owner",
                "account": "vault"
              }
            ]
          },
          "relations": [
            "beneficiary"
          ]
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
                "path": "beneficiarySigner"
              }
            ]
          }
        },
        {
          "name": "beneficiarySigner",
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
      "name": "claimSpl",
      "docs": [
        "Beneficiary claims their proportional share of a specific SPL / Token-2022 mint.",
        "Only callable after the countdown_duration has elapsed since trigger."
      ],
      "discriminator": [
        178,
        141,
        219,
        41,
        138,
        211,
        162,
        60
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
          },
          "relations": [
            "beneficiary"
          ]
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
                "path": "beneficiarySigner"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vaultAta",
          "docs": [
            "Vault's ATA for this mint (source). Must exist — populated by deposit_spl."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
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
          "name": "beneficiaryAta",
          "docs": [
            "Beneficiary's ATA for this mint (destination) — created if absent."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "beneficiarySigner"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
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
          "name": "beneficiarySigner",
          "writable": true,
          "signer": true
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
      "name": "deposit",
      "docs": [
        "Deposit SOL into the vault.",
        "Vault must be locked before deposits are accepted."
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
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
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "depositArgs"
            }
          }
        }
      ]
    },
    {
      "name": "depositSpl",
      "docs": [
        "Deposit SPL / Token-2022 tokens (or standard Metaplex NFTs) into the vault.",
        "Creates the vault's ATA for the given mint idempotently.",
        "The caller must pass the token_program matching the mint's owner",
        "(spl_token::ID for legacy tokens, spl_token_2022::ID for Token-2022)."
      ],
      "discriminator": [
        224,
        0,
        198,
        175,
        198,
        47,
        105,
        204
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
          "name": "mint",
          "docs": [
            "The SPL / Token-2022 mint to deposit. Pass the same token_program",
            "that owns this mint (spl_token::ID or spl_token_2022::ID)."
          ]
        },
        {
          "name": "ownerAta",
          "docs": [
            "Owner's token account (source)."
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
                "path": "mint"
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
          "name": "vaultAta",
          "docs": [
            "Vault's ATA (destination) — created idempotently if absent."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
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
              "name": "depositSplArgs"
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
        "Owner check-in — proves the owner is alive and resets the heartbeat.",
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
      "name": "triggerCountdown",
      "docs": [
        "Trigger the countdown after a missed heartbeat.",
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
      "name": "depositArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "depositSplArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
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
          }
        ]
      }
    }
  ]
};
