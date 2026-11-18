/* Deterministic ranking and feedback state for the simulated catalogue. */
(function (root) {
  const tracks = [
    { id: 'glass', title: 'Glass Hour', artist: 'Mira Vale', style: 'Ambient', score: 95, colour: 'peach', notes: [57, 60, 64, 67, 62, 64, 60, 55] },
    { id: 'paper', title: 'Paper Moon', artist: 'Sora Field', style: 'Synth pop', score: 92, colour: 'lavender', notes: [62, 69, 66, 74, 71, 69, 66, 64] },
    { id: 'tide', title: 'Low Tide', artist: 'Harbor Atlas', style: 'Ambient', score: 86, colour: 'green', notes: [50, 57, 60, 65, 62, 57, 53, 55] },
    { id: 'signal', title: 'Second Signal', artist: 'Nico Drift', style: 'Synth pop', score: 80, colour: 'rose', notes: [60, 64, 67, 72, 67, 65, 64, 62] },
    { id: 'window', title: 'Open Window', artist: 'Cedar Lines', style: 'Chillhop', score: 74, colour: 'sage', notes: [55, 59, 62, 69, 67, 64, 62, 57] },
    { id: 'city', title: 'City After Rain', artist: 'Lumen Park', style: 'Chillhop', score: 69, colour: 'gold', notes: [53, 60, 65, 67, 68, 67, 63, 60] },
  ];
  const styleNames = [...new Set(tracks.map(track => track.style))];
  const modes = ['scoped', 'baseline', 'targeted'];
  const emptyProfile = { tracks: [], styles: [] };
  const penalty = 28;

  function loadProfile(raw) {
    const result = {};
    for (const mode of modes) {
      const saved = raw?.[mode];
      // Earlier versions stored a list of track IDs for each mode.
      const trackIds = Array.isArray(saved) ? saved : saved?.tracks;
      const styles = mode === 'targeted' ? saved?.styles : undefined;
      result[mode] = {
        tracks: Array.isArray(trackIds) ? tracks.map(track => track.id).filter(id => trackIds.includes(id)) : [],
        styles: Array.isArray(styles) ? styleNames.filter(style => styles.includes(style)) : [],
      };
    }
    return result;
  }

  function rank(profile = emptyProfile, hidden = [], seen = []) {
    return tracks
      .filter(track => !hidden.includes(track.id) && !seen.includes(track.id))
      .map(track => {
        const trackFlag = profile.tracks.includes(track.id);
        const styleFlag = profile.styles.includes(track.style);
        return {
          ...track,
          trackFlag,
          styleFlag,
          adjusted: track.score - (trackFlag || styleFlag ? penalty : 0),
        };
      })
      .sort((a, b) => b.adjusted - a.adjusted || b.score - a.score);
  }

  function advance(state) {
    let queue = rank(state.profile, state.hidden, state.seen);
    if (!queue.length && state.seen.length) {
      const eligible = rank(state.profile, state.hidden);
      // At the end of a rotation, avoid immediately repeating the same track.
      state.seen = eligible.length > 1 ? state.seen.slice(-1) : [];
      queue = rank(state.profile, state.hidden, state.seen);
    }
    state.current = queue[0]?.id ?? null;
  }

  function start(profile = emptyProfile, number = 1) {
    const state = { profile, hidden: [], seen: [], current: null, number, undo: null };
    advance(state);
    return state;
  }

  function apply(state, action) {
    if (action === 'new') return start(state.profile, state.number + 1);
    if (action === 'undo') return state.undo ?? state;
    if (!state.current || !['skip', 'later', 'less', 'less-style', 'dislike'].includes(action)) return state;

    const next = {
      ...state,
      seen: [...state.seen, state.current],
      undo: action === 'skip' ? null : { ...state, undo: null },
    };
    if (action === 'later') next.hidden = [...state.hidden, state.current];
    if (action === 'less' || action === 'dislike') {
      next.profile = { ...state.profile, tracks: [...new Set([...state.profile.tracks, state.current])] };
    }
    if (action === 'less-style') {
      const { style } = tracks.find(track => track.id === state.current);
      next.profile = { ...state.profile, styles: [...new Set([...state.profile.styles, style])] };
    }
    advance(next);
    return next;
  }

  const engine = { tracks, loadProfile, rank, start, apply };
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
  else root.Afterbeat = engine;
})(typeof globalThis === 'undefined' ? this : globalThis);
