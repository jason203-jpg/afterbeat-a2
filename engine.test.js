const assert = require('node:assert/strict');
const { test } = require('node:test');
const { apply, loadProfile, rank, start, tracks } = require('./engine');

test('a session hide clears on a new session and leaves the saved list alone', () => {
  const state = apply(start(), 'later');
  assert.equal(state.current, 'paper');
  assert.deepEqual(state.hidden, ['glass']);
  assert.deepEqual(state.profile, { tracks: [], styles: [] });
  assert.equal(apply(state, 'new').current, 'glass');
});

test('future feedback and baseline dislike lower the same item without banning it', () => {
  for (const action of ['less', 'dislike']) {
    const state = apply(start(), action);
    const next = apply(state, 'new');
    assert.equal(next.current, 'paper');
    assert.deepEqual(next.hidden, []);
    assert.equal(rank(next.profile).at(-1).id, 'glass');
    assert.equal(rank(next.profile).at(-1).adjusted, 67);
  }
});

test('undo restores the current track and the prior memory', () => {
  const initial = start({ tracks: ['paper'], styles: ['Chillhop'] });
  for (const action of ['later', 'less', 'less-style', 'dislike']) {
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
  assert.deepEqual(state.profile, { tracks: [], styles: [] });
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

test('legacy histories migrate and only the extension accepts saved styles', () => {
  const raw = {
    scoped: ['glass', 'unknown', 'glass'],
    baseline: { tracks: ['tide'], styles: ['Chillhop'] },
    targeted: { tracks: ['city'], styles: ['Ambient', 'Ambient', 'unknown'] },
  };
  assert.deepEqual(loadProfile(raw), {
    scoped: { tracks: ['glass'], styles: [] },
    baseline: { tracks: ['tide'], styles: [] },
    targeted: { tracks: ['city'], styles: ['Ambient'] },
  });
});

test('track feedback moves one song while style feedback moves both matching songs', () => {
  const rankAfter = action => rank(apply(apply(start(), action), 'new').profile);
  assert.deepEqual(rankAfter('less').map(track => track.id), ['paper', 'tide', 'signal', 'window', 'city', 'glass']);
  const styleRanking = rankAfter('less-style');
  assert.deepEqual(styleRanking.map(track => track.id), ['paper', 'signal', 'window', 'city', 'glass', 'tide']);
  for (const track of styleRanking) {
    assert.equal(track.adjusted, track.score - (track.style === 'Ambient' ? 28 : 0));
  }
});

test('overlapping track and style feedback only applies the preference penalty once', () => {
  const ranking = rank({ tracks: ['glass'], styles: ['Ambient'] });
  const glass = ranking.find(track => track.id === 'glass');
  assert.equal(glass.adjusted, 67);
  assert.equal(glass.trackFlag && glass.styleFlag, true);
});
