const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const app = require('../dist/app.js').default;
const model = require('../dist/models/todoModel.js').default;
const pool = require('../dist/config/database.js').default;

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
  }
  await pool.end();
});

async function http(method, path, body) {
  const options = { method };

  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(baseUrl + path, options);
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null
  };
}

async function withMock(target, method, implementation, action) {
  const original = target[method];
  target[method] = implementation;

  try {
    return await action();
  } finally {
    target[method] = original;
  }
}

// GET /api/todos - filtered list
test('GET /api/todos supports filters', async () => {
  const rows = [{ id: 1, title: 'Work', completed: true }];

  await withMock(model, 'getAllTodos', async filters => {
    assert.deepEqual(filters, {
      completed: true,
      priority: 'high',
      search: 'work'
    });
    return rows;
  }, async () => {
    const res = await http(
      'GET',
      '/api/todos?completed=true&priority=high&search=work'
    );

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, rows);
  });
});

// GET /api/todos/:id - success
test('GET /api/todos/:id returns todo', async () => {
  const todo = { id: 1, title: 'Task 1' };

  await withMock(model, 'getTodoById', async id => {
    assert.equal(id, 1);
    return todo;
  }, async () => {
    const res = await http('GET', '/api/todos/1');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, todo);
  });
});

// GET /api/todos/:id - invalid
test('GET invalid todo ID returns 400', async () => {
  const res = await http('GET', '/api/todos/invalid');
  assert.equal(res.status, 400);
});

// GET /api/todos/:id - not found
test('GET missing todo returns 404', async () => {
  await withMock(model, 'getTodoById', async () => null, async () => {
    const res = await http('GET', '/api/todos/999');
    assert.equal(res.status, 404);
  });
});

// POST /api/todos - success
test('POST /api/todos creates todo', async () => {
  await withMock(model, 'createTodo', async input => {
    assert.equal(input.title, 'New Task');
    assert.equal(input.priority, 'high');

    return { id: 2, ...input };
  }, async () => {
    const res = await http('POST', '/api/todos', {
      title: ' New Task ',
      priority: 'high'
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'New Task');
  });
});

// POST /api/todos - validation
test('POST empty title returns 400', async () => {
  const res = await http('POST', '/api/todos', {
    title: ' '
  });

  assert.equal(res.status, 400);
});

test('POST invalid priority returns 400', async () => {
  const res = await http('POST', '/api/todos', {
    title: 'Task',
    priority: 'urgent'
  });

  assert.equal(res.status, 400);
});

// PUT /api/todos/:id
test('PUT /api/todos/:id updates todo', async () => {
  await withMock(model, 'updateTodo', async (id, updates) => {
    assert.equal(id, 2);
    assert.equal(updates.title, 'Updated Task');

    return { id, ...updates };
  }, async () => {
    const res = await http('PUT', '/api/todos/2', {
      title: ' Updated Task '
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'Updated Task');
  });
});

test('PUT invalid priority returns 400', async () => {
  const res = await http('PUT', '/api/todos/2', {
    priority: 'urgent'
  });

  assert.equal(res.status, 400);
});

// PATCH /api/todos/:id/toggle
test('PATCH toggles completed status', async () => {
  await withMock(model, 'toggleTodo', async id => {
    assert.equal(id, 2);
    return { id, completed: true };
  }, async () => {
    const res = await http('PATCH', '/api/todos/2/toggle');

    assert.equal(res.status, 200);
    assert.equal(res.body.completed, true);
  });
});

// DELETE /api/todos/:id
test('DELETE /api/todos/:id returns 204', async () => {
  await withMock(model, 'deleteTodo', async id => {
    assert.equal(id, 2);
    return true;
  }, async () => {
    const res = await http('DELETE', '/api/todos/2');

    assert.equal(res.status, 204);
    assert.equal(res.body, null);
  });
});

test('DELETE missing todo returns 404', async () => {
  await withMock(model, 'deleteTodo', async () => false, async () => {
    const res = await http('DELETE', '/api/todos/999');
    assert.equal(res.status, 404);
  });
});

// GET /ready - mocked database
test('GET /ready returns 200 when DB is reachable', async () => {
  await withMock(pool, 'query', async sql => {
    assert.equal(sql, 'SELECT 1');
    return { rows: [{ '?column?': 1 }] };
  }, async () => {
    const res = await http('GET', '/ready');

    assert.equal(res.status, 200);
    assert.equal(res.body.database, 'connected');
  });
});

test('GET /ready returns 503 when DB is unavailable', async () => {
  await withMock(pool, 'query', async () => {
    throw new Error('Simulated database failure');
  }, async () => {
    const res = await http('GET', '/ready');

    assert.equal(res.status, 503);
    assert.equal(res.body.database, 'disconnected');
  });
});