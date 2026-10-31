// 사용법: node build.mjs <암호>  → data.json 을 암호로 암호화해 data.enc.json 생성 (이것만 GitHub에 올림)
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as c } from 'node:crypto';

const pass = process.argv[2];
if (!pass) { console.error('암호를 인자로 주세요: node build.mjs 123456'); process.exit(1); }

const iter = 600000;
const salt = c.getRandomValues(new Uint8Array(16));
const iv = c.getRandomValues(new Uint8Array(12));
const km = await c.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
const key = await c.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = await c.subtle.encrypt({ name: 'AES-GCM', iv }, key, readFileSync('data.json'));
const b64 = (u) => Buffer.from(u).toString('base64');

writeFileSync('data.enc.json', JSON.stringify({
  iter, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)),
  len: /^\d+$/.test(pass) ? pass.length : 0, // 숫자 암호면 자릿수만큼 키패드, 아니면 글자 입력창
}));
console.log('data.enc.json 생성 완료');
