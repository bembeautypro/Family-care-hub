// Web Push helper for Cloudflare Workers (WebCrypto only).
// Implements aes128gcm payload encryption (RFC 8291) + VAPID JWT (ES256).

type Subscription = {
  endpoint: string;
  p256dh: string; // base64url uncompressed pub key (65 bytes)
  auth: string; // base64url 16-byte secret
};

function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

function uncompressedToJwk(raw: Uint8Array): { x: string; y: string } {
  if (raw[0] !== 0x04 || raw.length !== 65) throw new Error("Invalid EC public key");
  return {
    x: b64urlEncode(raw.slice(1, 33)),
    y: b64urlEncode(raw.slice(33, 65)),
  };
}

async function importVapidPrivateKey(
  privB64u: string,
  pubB64u: string,
): Promise<CryptoKey> {
  const pubRaw = b64urlDecode(pubB64u);
  const { x, y } = uncompressedToJwk(pubRaw);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: privB64u,
    x,
    y,
    ext: true,
  };
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function vapidAuthHeader(endpoint: string): Promise<string> {
  const pub = process.env.VAPID_PUBLIC_KEY!;
  const priv = process.env.VAPID_PRIVATE_KEY!;
  const sub = process.env.VAPID_SUBJECT!;
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const claims = {
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub,
  };
  const enc = (o: unknown) =>
    b64urlEncode(new TextEncoder().encode(JSON.stringify(o)));
  const signingInput = `${enc(header)}.${enc(claims)}`;

  const key = await importVapidPrivateKey(priv, pub);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64urlEncode(sig)}`;
  return `vapid t=${jwt}, k=${pub}`;
}

async function encryptPayload(
  payload: Uint8Array,
  subscription: Subscription,
): Promise<Uint8Array> {
  const uaPubRaw = b64urlDecode(subscription.p256dh);
  const authSecret = b64urlDecode(subscription.auth);

  // 1. Generate ephemeral server keypair.
  const asKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const asPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", asKeyPair.publicKey),
  );

  // 2. Import UA public key & derive shared secret.
  const uaPubKey = await crypto.subtle.importKey(
    "raw",
    uaPubRaw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPubKey },
    asKeyPair.privateKey,
    256,
  );
  const shared = new Uint8Array(sharedBits);

  // 3. HKDF(salt=authSecret, ikm=shared, info=keyInfo) → IKM (32 bytes).
  const keyInfo = concat(
    new TextEncoder().encode("WebPush: info\0"),
    uaPubRaw,
    asPubRaw,
  );
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);

  // 4. salt + HKDF(salt, ikm, info) → CEK (16) + nonce (12).
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(
    salt,
    ikm,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    salt,
    ikm,
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    12,
  );

  // 5. AES-128-GCM encrypt(payload || 0x02).
  const cekKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const plain = concat(payload, new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekKey, plain),
  );

  // 6. Assemble record: salt(16) || rs(4 BE) || idlen(1) || keyid(asPub 65) || ciphertext.
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const idlen = new Uint8Array([asPubRaw.length]);
  return concat(salt, rs, idlen, asPubRaw, ciphertext);
}

export type PushPayload = {
  title: string;
  body?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: { action: string; title: string }[];
};

export type SendResult = { ok: boolean; status: number; gone: boolean };

export async function sendWebPush(
  subscription: Subscription,
  payload: PushPayload,
  ttlSeconds = 60 * 60,
): Promise<SendResult> {
  const body = await encryptPayload(
    new TextEncoder().encode(JSON.stringify(payload)),
    subscription,
  );
  const auth = await vapidAuthHeader(subscription.endpoint);
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "Content-Length": String(body.length),
      TTL: String(ttlSeconds),
      Urgency: "high",
      Authorization: auth,
    },
    body,
  });
  return {
    ok: res.ok,
    status: res.status,
    gone: res.status === 404 || res.status === 410,
  };
}
