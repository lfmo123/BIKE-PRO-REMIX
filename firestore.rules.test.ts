import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, beforeAll, afterAll, beforeEach, it } from 'vitest';

let testEnv: RulesTestEnvironment;

describe('Firestore Security Rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-test-project',
      firestore: {
        rules: readFileSync(resolve(__dirname, 'DRAFT_firestore.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  const aliceId = 'alice_uid';
  const bobId = 'bob_uid';

  const aliceAuth = {
    uid: aliceId,
    email: 'alice@example.com',
    email_verified: true,
  };

  const bobAuth = {
    uid: bobId,
    email: 'bob@example.com',
    email_verified: true,
  };

  const unverifiedAuth = {
    uid: 'unverified_uid',
    email: 'hacker@example.com',
    email_verified: false,
  };

  function getFirestore(auth: any = null) {
    if (!auth) return testEnv.unauthenticatedContext().firestore();
    return testEnv.authenticatedContext(auth.uid, { ...auth }).firestore();
  }

  it('Payload 1: Identity Spoofing (Create vehicle with mismatching userId)', async () => {
    const db = getFirestore(aliceAuth);
    const ref = db.collection(`users/${bobId}/vehicles`).doc('veh123');
    await assertFails(ref.set({
      type: 'bicycle',
      identifier: 'bike1',
      ownerName: 'Alice',
      cardNumber: '123',
      checkInTime: 1234567890,
      status: 'active',
      userId: aliceId, 
    }));
  });

  it('Payload 2: State Immutability Bypass (Change checkInTime)', async () => {
    const db = getFirestore(aliceAuth);
    // Setup document via an admin context or successful creation
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection(`users/${aliceId}/vehicles`).doc('veh123').set({
        type: 'bicycle',
        identifier: 'bike1',
        ownerName: 'Alice',
        cardNumber: '123',
        checkInTime: 100,
        status: 'active',
        userId: aliceId,
      });
    });

    const ref = db.collection(`users/${aliceId}/vehicles`).doc('veh123');
    await assertFails(ref.update({
      checkInTime: 200,
    }));
  });

  it('Payload 3: Ghost Field (Shadow Update)', async () => {
    const db = getFirestore(aliceAuth);
    const ref = db.collection(`users/${aliceId}/vehicles`).doc('veh123');
    await assertFails(ref.set({
      type: 'bicycle',
      identifier: 'bike1',
      ownerName: 'Alice',
      cardNumber: '123',
      checkInTime: 1234567890,
      status: 'active',
      userId: aliceId,
      isHacked: true, // ghost field
    }));
  });

  it('Payload 4: Denial of Wallet (Identifier > 50 chars)', async () => {
    const db = getFirestore(aliceAuth);
    const ref = db.collection(`users/${aliceId}/vehicles`).doc('veh123');
    await assertFails(ref.set({
      type: 'bicycle',
      identifier: 'A'.repeat(51),
      ownerName: 'Alice',
      cardNumber: '123',
      checkInTime: 1234567890,
      status: 'active',
      userId: aliceId,
    }));
  });

  it('Payload 5: Array/String Type Exploitation', async () => {
    const db = getFirestore(aliceAuth);
    const ref = db.collection(`users/${aliceId}/vehicles`).doc('veh123');
    await assertFails(ref.set({
      type: 'bicycle',
      identifier: 12345 as any, // should be string
      ownerName: 'Alice',
      cardNumber: '123',
      checkInTime: 1234567890,
      status: 'active',
      userId: aliceId,
    }));
  });

  it('Payload 6: Path ID Poisoning (setting settings doc to something else)', async () => {
    const db = getFirestore(aliceAuth);
    const ref = db.collection(`users/${aliceId}/settings`).doc('A'.repeat(129));
    await assertFails(ref.set({
      bicycle: 5, ebike: 8, motorcycle: 12, totalSpots: 50, userId: aliceId
    }));
  });

  it('Payload 7: Cross-Tenant Read/List', async () => {
    const db = getFirestore(bobAuth);
    const ref = db.collection(`users/${aliceId}/vehicles`);
    await assertFails(ref.get());
  });

  it('Payload 8: Value Poisoning (updating status to hacked)', async () => {
    const db = getFirestore(aliceAuth);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection(`users/${aliceId}/vehicles`).doc('veh123').set({
        type: 'bicycle',
        identifier: 'bike1',
        ownerName: 'Alice',
        cardNumber: '123',
        checkInTime: 100,
        status: 'active',
        userId: aliceId,
      });
    });

    const ref = db.collection(`users/${aliceId}/vehicles`).doc('veh123');
    await assertFails(ref.update({
      status: 'hacked',
    }));
  });

  it('Payload 9: Unverified Email (Unverified auth makes writes fail)', async () => {
     const db = getFirestore(unverifiedAuth);
     const ref = db.collection(`users/unverified_uid/vehicles`).doc('v1');
     await assertFails(ref.set({
      type: 'bicycle',
      identifier: 'bike1',
      ownerName: 'Alice',
      cardNumber: '123',
      checkInTime: 1234567890,
      status: 'active',
      userId: 'unverified_uid',
     }));
  });

  it('Payload 10: Terminal State Lockdown', async () => {
    const db = getFirestore(aliceAuth);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection(`users/${aliceId}/vehicles`).doc('veh123').set({
        type: 'bicycle',
        identifier: 'bike1',
        ownerName: 'Alice',
        cardNumber: '123',
        checkInTime: 100,
        status: 'completed',
        userId: aliceId,
        price: 10,
        paymentMethod: 'cash',
        checkOutTime: 200
      });
    });

    const ref = db.collection(`users/${aliceId}/vehicles`).doc('veh123');
    // Cannot update status or any field once completed
    await assertFails(ref.update({
      price: 0,
    }));
  });

  it('Payload 11: Action Key Deviation (Update only specific keys using hasOnly)', async () => {
    const db = getFirestore(aliceAuth);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection(`users/${aliceId}/vehicles`).doc('veh123').set({
        type: 'bicycle',
        identifier: 'bike1',
        ownerName: 'Alice',
        cardNumber: '123',
        checkInTime: 100,
        status: 'active',
        userId: aliceId,
      });
    });

    const ref = db.collection(`users/${aliceId}/vehicles`).doc('veh123');
    // Say we only allow checkout (status, price, checkOutTime, paymentMethod). Updating identifier goes outside the action.
    await assertFails(ref.update({
      status: 'completed',
      identifier: 'hacked',
    }));
  });

  it('Payload 12: Negative Pricing', async () => {
    const db = getFirestore(aliceAuth);
    const ref = db.collection(`users/${aliceId}/settings`).doc('pricing');
    await assertFails(ref.set({
      bicycle: -50, // fail
      ebike: 8,
      motorcycle: 12,
      userId: aliceId
    }));
  });
});
