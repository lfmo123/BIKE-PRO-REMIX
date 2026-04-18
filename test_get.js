const { readFileSync } = require('fs');
const { resolve } = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

(async () => {
  const testEnv = await initializeTestEnvironment({
    projectId: 'demo-test-project-2',
    firestore: {
      rules: readFileSync(resolve(__dirname, 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080
    },
  });

  const auth = { uid: 'alice_uid', email: 'alice@example.com', email_verified: true };
  const db = testEnv.authenticatedContext(auth.uid, auth).firestore();

  try {
    console.log("Testing get on non-existent pricing...");
    const ref = db.collection(`users/${auth.uid}/settings`).doc('pricing');
    await assertSucceeds(ref.get());
    console.log("Get test passed.");
  } catch (e) {
    console.error("Get test failed:", e);
  }

  process.exit(0);
})();
