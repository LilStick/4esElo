import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "./crypto";

const KEY = "0".repeat(64); // 32 octets

test("chiffre puis déchiffre → valeur d'origine", () => {
  const plain = "ABCD-EFGH-IJKL";
  const blob = encryptSecret(plain, KEY);
  assert.notEqual(blob, plain);
  assert.equal(decryptSecret(blob, KEY), plain);
});

test("deux chiffrements du même secret diffèrent (IV aléatoire)", () => {
  assert.notEqual(encryptSecret("x", KEY), encryptSecret("x", KEY));
});

test("mauvaise clé → échec", () => {
  const blob = encryptSecret("secret", KEY);
  assert.throws(() => decryptSecret(blob, "1".repeat(64)));
});

test("blob altéré → échec (auth tag GCM)", () => {
  const blob = encryptSecret("secret", KEY);
  const [iv, tag, enc] = blob.split(":");
  const tampered = [iv, tag, Buffer.from("zzzz").toString("base64")].join(":");
  assert.throws(() => decryptSecret(tampered, KEY));
});

test("clé de mauvaise taille → erreur", () => {
  assert.throws(() => encryptSecret("x", "abcd"));
});
