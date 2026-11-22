import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {handle} from '../market/service.mjs';

function call(path, data, {user, respond} = {}) {
  const queries = [];
  const pool = {connect: async () => ({
    query: async (sql, values) => {
      queries.push({sql, values});
      if (sql.startsWith('SELECT s.role')) return {rows: user ? [user] : []};
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return {};
      const result = respond?.(sql, values);
      assert.ok(result, `Unexpected query: ${sql}`);
      return result;
    },
    release() {},
  })};
  const request = new Request(`http://localhost/api/market/${path}`, {
    method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(data),
  });
  return handle(request, pool).then(response => ({response, queries}));
}

test('закупщик не может менять реквизиты и приглашать сотрудников', async () => {
  const user = {role: 'buyer', company: 9};
  for (const path of ['company-profile', 'member']) {
    const {response, queries} = await call(path, {}, {user});
    assert.equal(response.status, 403);
    assert.equal(queries.at(-1).sql, 'ROLLBACK');
  }
});

test('реквизиты пишутся только в компанию текущей сессии', async () => {
  const {response} = await call('company-profile', {company: 1, legalName: 'Демо', taxId: '0123456789'}, {
    user: {role: 'buyer_admin', company: 9},
    respond(sql, args) {
      assert.match(sql, /WHERE id=\$3/);
      assert.deepEqual(args, ['Демо', '0123456789', 9]);
      return {rowCount: 1};
    },
  });
  assert.equal(response.status, 200);
});

test('сотруднику нельзя назначить роль другого типа компании', async () => {
  const {response} = await call('member', {company: 1, role: 'supplier'}, {
    user: {role: 'buyer_admin', company: 9},
    respond(sql, args) {
      assert.match(sql, /^SELECT kind/);
      assert.deepEqual(args, [9]);
      return {rows: [{kind: 'buyer'}]};
    },
  });
  assert.equal(response.status, 422);
});

test('код сотрудника сохраняется в виде хеша, а попытка входа проверяет пару почта и код', async () => {
  const code = randomUUID();
  let hash;
  const created = await call('member', {name: 'Закупщик', email: 'Demo@example.test', role: 'buyer', code}, {
    user: {role: 'buyer_admin', company: 9},
    respond(sql, args) {
      if (sql.startsWith('SELECT kind')) return {rows: [{kind: 'buyer'}]};
      assert.match(sql, /^INSERT INTO market_members/);
      assert.equal(args[2], 'demo@example.test');
      hash = args[4];
      assert.match(hash, /^[a-f0-9]{64}$/);
      return {rowCount: 1};
    },
  });
  assert.equal(created.response.status, 200);

  const auth = await call('login', {email: 'DEMO@example.test', code}, {
    respond(sql, args) {
      if (sql.startsWith('DELETE FROM sessions')) return {};
      if (sql.startsWith('SELECT m.id')) {
        assert.deepEqual(args, ['demo@example.test', hash]);
        return {rows: [{id: 7, role: 'buyer', company: 9}]};
      }
      assert.deepEqual(args.slice(1), ['buyer', 9, 7]);
      return {rowCount: 1};
    },
  });
  assert.equal(auth.response.status, 200);
  assert.match(auth.response.headers.get('set-cookie'), /HttpOnly/);
});

test('поставщик не может изменить условия предложения другой компании', async () => {
  const {response, queries} = await call('offer-details', {id: 4, sku: 'А-4', pack: 4, step: 3, active: false}, {
    user: {role: 'supplier', company: 1},
    respond(sql, args) {
      assert.match(sql, /WHERE id=\$5 AND supplier=\$6/);
      assert.deepEqual(args, ['А-4', 4, 3, false, 4, 1]);
      return {rowCount: 0};
    },
  });
  assert.equal(response.status, 404);
  assert.equal(queries.at(-1).sql, 'ROLLBACK');
});

for (const {line,status,error} of [
  {line:{id:1,quantity:5,price:120},status:409,error:/размер партии/},
  {line:{id:1,quantity:7,price:100},status:409,error:/Цена изменилась/},
  {line:{id:1,quantity:7,price:120},status:422,error:/Дата доставки недоступна/},
]) {
  test(`оформление отменяет транзакцию при ошибке «${error.source}»`, async () => {
    const {response,queries} = await call('checkout', {
      key:randomUUID(),address:'Демо адрес',dates:{1:'2026-02-31'},lines:[line],
    }, {
      user:{role:'buyer',company:9},
      respond(sql) {
        if (sql.startsWith('INSERT INTO checkouts')) return {rowCount:1};
        assert.match(sql,/WHERE o.id=\$1 AND o.active/);
        return {rows:[{supplier:1,stock:40,pack:4,step:3,price:120,minimum:500,lead_days:1,delivery_days:[1]}]};
      },
    });
    assert.equal(response.status,status);
    assert.match((await response.json()).error,error);
    assert.equal(queries.at(-1).sql,'ROLLBACK');
    assert.ok(!queries.some(query=>query.sql.startsWith('INSERT INTO orders')));
  });
}
