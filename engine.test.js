const assert = require('node:assert/strict');
const { test } = require('node:test');
const { apply, loadProfile, rank, start, tracks } = require('./engine');

test('a session hide clears on a new session and leaves the saved list alone', () => {
  const state = apply(start(), 'later');
  assert.equal(state.current, 'paper');
  assert.deepEqual(state.hidden, ['glass']);
  assert.deepEqual(state.saved, []);
  assert.equal(apply(state, 'new').current, 'glass');
});

test('future feedback and baseline dislike lower the same item without banning it', () => {
  for (const action of ['less', 'dislike']) {
    const state = apply(start(), action);
    const next = apply(state, 'new');
    assert.equal(next.current, 'paper');
    assert.deepEqual(next.hidden, []);
    assert.equal(rank(next.saved).at(-1).id, 'glass');
    assert.equal(rank(next.saved).at(-1).adjusted, 67);
  }
});

test('undo restores the current track and the prior memory', () => {
  const initial = start(['paper']);
  for (const action of ['later', 'less', 'dislike']) {
    assert.deepEqual(apply(apply(initial, action), 'undo'), initial);
  }
});

test('ordinary skips rotate without persisting a negative signal', () => {
  let state = start();
  const played = [];
  for (let index = 0; index < tracks.length; index++) {
    played.push(state.current);
    state = apply(state, 'skip');
  }
  assert.equal(new Set(played).size, tracks.length);
  assert.equal(state.current, 'glass');
  assert.deepEqual(state.saved, []);
  assert.deepEqual(state.hidden, []);
});

test('a fully hidden catalogue ends the session and can recover with undo', () => {
  let state = start();
  for (const track of tracks) {
    assert.equal(state.current, track.id);
    state = apply(state, 'later');
  }
  assert.equal(state.current, null);
  assert.equal(apply(state, 'undo').current, 'city');
  assert.equal(apply(state, 'new').current, 'glass');
});

test('stored histories are isolated and unknown or duplicated tracks are removed', () => {
  const raw = { scoped: ['glass', 'unknown', 'glass'], baseline: ['tide'] };
  assert.deepEqual(loadProfile(raw), { scoped: ['glass'], baseline: ['tide'] });
  assert.deepEqual(loadProfile({ baseline: true }), { scoped: [], baseline: [] });
});
