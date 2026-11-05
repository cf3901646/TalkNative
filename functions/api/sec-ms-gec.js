const WIN_EPOCH_SECONDS = 11644473600;
const TOKEN_WINDOW_SECONDS = 300;
const SHA256_INITIAL = [
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
];
const SHA256_PREFIX_STATE = [
  4255104674,
  2435071207,
  3192492180,
  3442351626,
  1811967817,
  79508907,
  4272990180,
  66059218
];
const SHA256_PREFIX_SCHEDULE = [
  3945054110,
  358115615,
  2696978146,
  217723578,
  2787307148,
  3520959633,
  3235718560,
  4192668342,
  4039316851,
  1884868174,
  1904797190,
  15051571,
  3529027680,
  1920361828
];
const SHA256_ROUND_CONSTANTS = [
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
];
const SHA256_ROUND_14_ADJUSTMENT = 3386640039;
const SHA256_PREFIX_BLOCK_CONSTANTS = SHA256_ROUND_CONSTANTS.map(
  (constant, index) => index === 14 ? SHA256_ROUND_14_ADJUSTMENT : constant
);
const SHA256_SIGMA0_ADJUSTMENT = 94112640;
const SHA256_SIGMA1_ADJUSTMENT = 758464;
const CS64_COEFFICIENTS = [
  [3895366065, 3005677776],
  [1155409094, 2296378653],
  [1005282748, 693190712],
  [3365689651, 3005795295],
  [2367603217, 3557143765],
  [827258325, 652566332],
  [3911487921, 1618477510],
  [4037392853, 2192753147],
  [101076211, 4199654362],
  [3665427040, 545047652],
  [3201434976, 1010595059],
  [2314848760, 3536931681],
  [905590982, 3137643201],
  [3410617286, 3311559015]
];
const CS64_FACTOR = 2190031155;
const CS64_ADJUSTMENT0 = 4076407578;
const CS64_ADJUSTMENT1 = 186253312;
function rotr(value, bits) {
  return (value >>> bits | value << 32 - bits) >>> 0;
}
function rol16(value) {
  return (value << 16 | value >>> 16) >>> 0;
}
function sigma0(value) {
  return (rotr(value, 7) ^ rotr(value, 18) ^ value >>> 3) >>> 0;
}
function sigma1(value) {
  return (rotr(value, 17) ^ rotr(value, 19) ^ value >>> 10) >>> 0;
}
function expandSchedule(words, firstWord = 16) {
  for (let index = firstWord; index < 64; index += 1) {
    words[index] = sigma1(words[index - 2]) + words[index - 7] + sigma0(words[index - 15]) + words[index - 16] >>> 0;
  }
}
function compress(state, words, firstRound = 0) {
  const constants = firstRound === 14 ? SHA256_PREFIX_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS;
  let [a, b, c, d, e, f, g, h] = state;
  for (let index = firstRound; index < 64; index += 1) {
    const t1 = h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + (g ^ e & (f ^ g)) + constants[index] + words[index] >>> 0;
    const t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + (a & b | c & (a | b)) >>> 0;
    h = g;
    g = f;
    f = e;
    e = d + t1 >>> 0;
    d = c;
    c = b;
    b = a;
    a = t1 + t2 >>> 0;
  }
  return [a, b, c, d, e, f, g, h];
}
function prefixBlockState(payload) {
  const words = new Array(14).fill(0);
  words.push(payload[0] << 16 | payload[1] << 8 | payload[2]);
  words.push(
    (payload[3] << 24 | payload[4] << 16 | payload[5] << 8 | payload[6]) >>> 0
  );
  for (let index = 16; index < 30; index += 1) {
    let value = SHA256_PREFIX_SCHEDULE[index - 16] + (index === 16 ? (sigma1(words[14]) ^ SHA256_SIGMA1_ADJUSTMENT) >>> 0 : sigma1(words[index - 2]));
    if (index >= 21) {
      value += words[index - 7];
    }
    if (index === 29) {
      value += (sigma0(words[14]) ^ SHA256_SIGMA0_ADJUSTMENT) >>> 0;
    }
    words.push(value >>> 0);
  }
  words.push(
    sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + SHA256_ROUND_14_ADJUSTMENT - SHA256_ROUND_CONSTANTS[14] >>> 0
  );
  expandSchedule(words, 31);
  const working = compress(SHA256_PREFIX_STATE, words, 14);
  return SHA256_INITIAL.map((value, index) => value + working[index] >>> 0);
}
function sha256Digest(payload) {
  if (payload.length < 7) {
    throw new Error("Sec-MS-GEC payload must contain at least seven bytes");
  }
  const messageLength = 57 + payload.length;
  const zeroPadding = ((55 - messageLength) % 64 + 64) % 64;
  const tail = new Uint8Array(payload.length - 7 + 1 + zeroPadding + 8);
  tail.set(payload.subarray(7));
  tail[payload.length - 7] = 128;
  const tailView = new DataView(tail.buffer);
  const bitLength = messageLength * 8;
  tailView.setUint32(tail.length - 8, Math.floor(bitLength / 2 ** 32));
  tailView.setUint32(tail.length - 4, bitLength >>> 0);
  let state = prefixBlockState(payload);
  for (let offset = 0; offset < tail.length; offset += 64) {
    const words = [];
    for (let index = 0; index < 16; index += 1) {
      words.push(tailView.getUint32(offset + index * 4));
    }
    expandSchedule(words);
    const working = compress(state, words);
    state = state.map((value, index) => value + working[index] >>> 0);
  }
  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  state.forEach((value, index) => digestView.setUint32(index * 4, value));
  return digest;
}
function cs64Words(payload) {
  const byteLength = Math.ceil((payload.length + 1) / 8) * 8;
  const bytes = new Uint8Array(byteLength);
  bytes.set(payload, 1);
  const view = new DataView(bytes.buffer);
  const words = [];
  for (let offset = 0; offset < byteLength; offset += 4) {
    words.push(view.getUint32(offset, true));
  }
  return words;
}
function cs64Digest(payload, digest) {
  const digestView = new DataView(
    digest.buffer,
    digest.byteOffset,
    digest.byteLength
  );
  const keyA = (digestView.getUint32(0, true) | 1) >>> 0;
  const keyB = (digestView.getUint32(4, true) | 1) >>> 0;
  const factors = [
    Math.imul(keyA, CS64_FACTOR) >>> 0,
    Math.imul(keyB, CS64_FACTOR) >>> 0
  ];
  const terms = CS64_COEFFICIENTS.map(
    ([coefficient], index) => Math.imul(coefficient, factors[index % 2]) >>> 0
  );
  const offsets = CS64_COEFFICIENTS.map(([, offset]) => offset);
  cs64Words(payload).forEach((word, index) => {
    const even = index % 2 === 0;
    let term = Math.imul(word, even ? keyA : keyB);
    let offset = Math.imul(rol16(word), even ? 4010109435 : 3273069531);
    if (index === 0) {
      term += Math.imul(CS64_ADJUSTMENT0, factors[0]);
      offset += CS64_ADJUSTMENT1;
    }
    terms.push(term >>> 0);
    offsets.push(offset >>> 0);
  });
  let swapAcc = 0;
  let swapLast = 0;
  let state = 0;
  let acc = 0;
  for (let index = 0; index < terms.length; index += 2) {
    const x = terms[index];
    const y = terms[index + 1];
    let q = Math.imul(rol16(offsets[index] + x >>> 0), 1995771700) >>> 0;
    swapAcc = swapAcc + Math.imul(rol16(q), 3287280279) + q >>> 0;
    q = Math.imul(rol16(offsets[index + 1] + y >>> 0), 411160124) >>> 0;
    swapLast = Math.imul(rol16(q), 901586633) + q >>> 0;
    swapAcc = swapAcc + swapLast >>> 0;
    state = Math.imul(state, keyA) + x >>> 0;
    state = Math.imul(rol16(state), 3482890513) >>> 0;
    state = Math.imul(rol16(state), 2265471903) >>> 0;
    state = Math.imul(rol16(state), 315537773) >>> 0;
    state = Math.imul(rol16(state), 629022083) >>> 0;
    acc = acc + state >>> 0;
    let t = Math.imul(state, keyB) + y >>> 0;
    t = Math.imul(rol16(t), 2725517045) >>> 0;
    t = Math.imul(rol16(t), 3548616447) >>> 0;
    t = Math.imul(rol16(t), 2090019721) >>> 0;
    state = Math.imul(rol16(t), 3215236969) >>> 0;
    acc = acc + state >>> 0;
  }
  return [(swapLast ^ state) >>> 0, (swapAcc ^ acc) >>> 0];
}
function toHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}
function hashSecMsGecPayload(payload) {
  const bytes = new TextEncoder().encode(payload);
  const digest = sha256Digest(bytes);
  const checksum = new Uint8Array(8);
  const checksumView = new DataView(checksum.buffer);
  cs64Digest(bytes, digest).forEach(
    (word, index) => checksumView.setUint32(index * 4, word, true)
  );
  return `${toHex(checksum)}-${toHex(digest)}`;
}
function generateSecMsGec(trustedClientToken, unixSeconds = Date.now() / 1e3) {
  let ticks = unixSeconds + WIN_EPOCH_SECONDS;
  ticks -= ticks % TOKEN_WINDOW_SECONDS;
  ticks *= 1e7;
  return hashSecMsGecPayload(`${ticks.toFixed(0)}${trustedClientToken}`);
}
export {
  generateSecMsGec,
  hashSecMsGecPayload
};
