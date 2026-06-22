# Polygon anchoring — "Proof-of-Reunion"

## What it does
The audit log (`lib/audit.ts`) is a hash chain — each entry's hash includes the
previous one, so the **head hash commits to the entire history**. We anchor that
single 32-byte hash to **Polygon** by sending a transaction whose calldata *is*
the hash. Anyone can then verify, on a public ledger, that our records existed at
that time and were never altered — **without one byte of personal data on-chain.**

- Only a **hash** goes on-chain. Never a name, photo, or description.
- The whole thing is **graceful**: with no wallet configured, anchoring is
  disabled and the app runs normally. Nothing to break during a demo.

## Files
- `lib/chain.ts` — `anchorHash()` (ethers.js → Polygon), `isChainConfigured()`.
- `app/api/anchor/route.ts` — `POST` anchors the current chain head.
- `app/api/audit/route.ts` — `GET` now returns `anchors` + `chainConfigured`.
- UI: the **🔗 Audit trail** modal has an **"Anchor chain on-chain"** button +
  a list of anchors with Polygonscan links.

## Turn it on (real on-chain anchor, ~5 min, free testnet)
1. Install **MetaMask**, create a wallet, and copy its **private key**
   (Account details → Show private key). Use a throwaway wallet, not a real one.
2. Add the **Polygon Amoy testnet** and get free test MATIC from
   <https://faucet.polygon.technology> (select Amoy).
3. Put the key in `.env.local`:
   ```
   POLYGON_PRIVATE_KEY=0xYOUR_TESTNET_PRIVATE_KEY
   POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
   POLYGON_EXPLORER=https://amoy.polygonscan.com
   POLYGON_NETWORK=Polygon Amoy testnet
   ```
4. Restart the dev server. Open **🔗 Audit trail → Anchor chain on-chain** → you
   get a real transaction with a Polygonscan link.

## Security
- Never commit `POLYGON_PRIVATE_KEY` (it's in `.gitignore` via `.env.local`).
- Use a **testnet** wallet with no real funds.
- Anchoring is one-directional: it only ever *writes a hash*. It cannot read or
  expose any case data.

## Mainnet later
Swap `POLYGON_RPC_URL` to a Polygon mainnet RPC and fund the wallet with real
MATIC (gas is fractions of a cent). No code change.

## Defense (if a judge asks "why not put it all on-chain?")
> "Putting lost-children data on a public, permanent, unredactable ledger is a
> privacy and child-safety red line. We anchor only a cryptographic fingerprint
> of the audit chain — that's enough to prove the records are authentic and
> untampered, while the personal data stays in a private, deletable database.
> That's proof-of-existence done correctly."
