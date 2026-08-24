/**
 * Contract check for the avatar endpoints.
 *
 * Signs a local dev JWT and asserts the auth, validation, ownership and
 * storage-configuration paths. None of these cases touch the database, so the
 * check is usable even when Postgres is unreachable.
 *
 * Usage: node scripts/verify-avatar-endpoints.mjs
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';

const BASE_URL = process.env.VERIFY_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3105}`;
const USER_ID = 'ckverify0000000000000000';
const OTHER_USER_ID = 'ckintruder000000000000000';

const token = jwt.sign(
  { sub: USER_ID, email: 'verify@vidorax.dev', role: 'USER', type: 'access' },
  process.env.JWT_ACCESS_SECRET,
  { expiresIn: '5m' },
);

const call = async (method, path, { auth = true, body } = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  return { status: response.status, body: await response.text() };
};

const cases = [
  {
    name: 'POST upload-url without a token is rejected',
    run: () => call('POST', '/api/users/me/avatar/upload-url', { auth: false }),
    expect: 401,
  },
  {
    name: 'PUT avatar without a token is rejected',
    run: () =>
      call('PUT', '/api/users/me/avatar', {
        auth: false,
        body: { path: `${USER_ID}-1750000000000.jpg` },
      }),
    expect: 401,
  },
  {
    name: 'DELETE avatar without a token is rejected',
    run: () => call('DELETE', '/api/users/me/avatar', { auth: false }),
    expect: 401,
  },
  {
    name: 'PUT avatar rejects a malformed path',
    run: () => call('PUT', '/api/users/me/avatar', { body: { path: 'nope.png' } }),
    expect: 400,
  },
  {
    name: 'PUT avatar rejects a traversal path',
    run: () =>
      call('PUT', '/api/users/me/avatar', {
        body: { path: `../${USER_ID}-1750000000000.jpg` },
      }),
    expect: 400,
  },
  {
    name: "PUT avatar rejects another user's object",
    run: () =>
      call('PUT', '/api/users/me/avatar', {
        body: { path: `${OTHER_USER_ID}-1750000000000.jpg` },
      }),
    expect: 403,
  },
  {
    name: 'POST upload-url reports storage configuration state',
    run: () => call('POST', '/api/users/me/avatar/upload-url'),
    expect: process.env.SUPABASE_SERVICE_ROLE_KEY ? 201 : 503,
  },
];

let failures = 0;

for (const testCase of cases) {
  const { status, body } = await testCase.run();
  const ok = status === testCase.expect;

  if (!ok) {
    failures += 1;
  }

  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${testCase.name}\n      expected ${testCase.expect}, got ${status} ${body.slice(0, 160)}`,
  );
}

console.log(`\n${cases.length - failures}/${cases.length} passed`);
process.exit(failures === 0 ? 0 : 1);
