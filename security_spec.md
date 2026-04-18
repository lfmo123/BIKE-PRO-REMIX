# Security Specification

## 1. Data Invariants
- `Vehicle`: A vehicle record MUST belong to a valid `userId` which strictly matches `request.auth.uid`. A vehicle's `type` must be strictly string of either 'bicycle', 'ebike', or 'motorcycle'. A vehicle must maintain its `userId` and `checkInTime` immutably.
- `Pricing`: Pricing settings MUST belong strictly to the owner. `bicycle`, `ebike`, and `motorcycle` must be positive integers.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing**: User A creates a vehicle with `userId` of User B.
2. **State Shortcutting/Immutability Bypass**: Modifying `checkInTime` on update.
3. **Ghost Field (Shadow Update)**: Updating a vehicle with an unknown field `isVerified` or `isAdmin`.
4. **Denial of Wallet (Resource Poisoning)**: Creating a vehicle with an `identifier` over 200 characters long.
5. **Array/String Type Exploitation**: Passing an integer or object as an `identifier`.
6. **Path Variable ID Poisoning**: Creating a document with a document ID over 128 characters or containing invalid regex characters (assuming manual ID creation, though we typically let Firestore auto-generate IDs for vehicles, setting of predefined settings ID like 'pricing' is validated).
7. **Cross-Tenant Read**: User A tries to list vehicles where `userId` is User B or gets a vehicle owned by User B.
8. **Value Poisoning**: Updating `status` from 'active' to a non-string or unknown string like 'hacked'.
9. **Unverified Email (if used)**: Setting role based on unverified email (Note: email verified checks are mandatory for standard writes).
10. **Terminal State Lockdown**: Trying to modify `price` or `checkOutTime` after `status` has been marked as 'completed'.
11. **Action Key Deviation**: Updating `status` and `identifier` in the same operation, bypassing the explicit whitelist in `affectedKeys().hasOnly()`.
12. **Negative Pricing**: Trying to set `pricing.bicycle` to -100.

## 3. The Test Runner
It will be implemented in `firestore.rules.test.ts`.
