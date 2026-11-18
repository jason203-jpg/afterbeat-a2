const { tracks, loadProfile, rank, start, apply } = window.Afterbeat;
const $ = id => document.getElementById(id);
const storageKey = 'afterbeat-feedback-v1';
const lookup = new Map(tracks.map(track => [track.id, track]));
const versionNames = { scoped: 'Two choices', baseline: 'Single dislike', targeted: 'Track or style' };
let mode = 'scoped';
let profiles = loadProfile();
let audio;
let activeClip;
let audioTimer;
let audioGeneration = 0;
let previewActive = false;

try {
  const prior = localStorage.getItem(storageKey);
  if (prior) profiles = loadProfile(JSON.parse(prior));
} catch (error) {
  if (!(error instanceof SyntaxError)) $('storage-note').hidden = false;
}

let state = start(profiles[mode]);

function saveProfile() {
  profiles[mode] = state.profile;
  try {
    localStorage.setItem(storageKey, JSON.stringify(profiles));
  } catch {
    $('storage-note').hidden = false;
  }
}

function showStatus(text) {
  $('status').textContent = text;
}

function renderQueue() {
  const excluded = state.current ? [...state.seen, state.current] : state.seen;
  const queue = rank(state.profile, state.hidden, excluded);
  $('queue').replaceChildren(...queue.map(track => {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = `swatch ${track.colour}`;
    swatch.setAttribute('aria-hidden', 'true');
    const name = document.createElement('strong');
    name.textContent = track.title;
    const artist = document.createElement('small');
    artist.textContent = mode === 'targeted' ? `${track.artist} · ${track.style}` : track.artist;
    const text = document.createElement('span');
    text.append(name, artist);
    item.append(swatch, text);
    if (track.trackFlag || track.styleFlag) {
      const tag = document.createElement('span');
      tag.className = 'queue-tag';
      tag.textContent = track.styleFlag ? 'Style down-ranked' : 'Down-ranked';
      item.append(tag);
    }
    return item;
  }));
  $('queue-count').textContent = `${queue.length} tracks`;
  $('queue-empty').hidden = queue.length > 0;
  $('queue-empty').textContent = state.current ? 'End of this queue rotation.' : 'No tracks are eligible this session.';
  const list = ids => ids.map(id => lookup.get(id).title).join(', ') || 'None';
  $('hidden-tracks').textContent = list(state.hidden);
  $('saved-tracks').textContent = list(state.profile.tracks);
  $('style-history').hidden = mode !== 'targeted';
  $('saved-styles').textContent = state.profile.styles.join(', ') || 'None';
}

function render() {
  const track = lookup.get(state.current);
  $('session').textContent = `Session ${state.number}`;
  $('track-title').textContent = track?.title ?? 'Session complete';
  $('track-meta').textContent = track ? `${track.artist} · ${track.style}` : 'Start a new session to hear recommendations again.';
  $('art').className = `art ${track?.colour ?? 'sage'}`;
  $('controls').hidden = !track;
  $('feedback').textContent = mode === 'baseline' ? 'Dislike' : 'Feedback';
  $('undo').hidden = !state.undo;
  renderQueue();
}

function stopPreview() {
  audioGeneration++;
  activeClip?.stop();
  activeClip = undefined;
  clearTimeout(audioTimer);
  previewActive = false;
  $('preview').textContent = 'Play demo clip';
}

async function playPreview() {
  if (previewActive) {
    stopPreview();
    return;
  }
  const track = lookup.get(state.current);
  if (!track) return;
  const generation = ++audioGeneration;
  previewActive = true;
  $('preview').textContent = 'Stop clip';
  try {
    audio ??= new AudioContext();
    await audio.resume();
    if (generation !== audioGeneration) return;
    activeClip = window.AfterbeatMusic.schedule(audio, track);
    audioTimer = setTimeout(stopPreview, Math.ceil(1000 * activeClip.duration));
  } catch {
    if (generation === audioGeneration) {
      stopPreview();
      showStatus('Audio preview is unavailable in this browser.');
    }
  }
}

function act(action) {
  const track = lookup.get(state.current);
  stopPreview();
  state = apply(state, action);
  if (['less', 'less-style', 'dislike', 'undo'].includes(action)) saveProfile();
  render();
  const messages = {
    later: () => `${track.title} is hidden for this session.`,
    less: () => `${track.title} will rank lower in future sessions.`,
    'less-style': () => `${track.style} tracks will rank lower in future sessions.`,
    dislike: () => `Disliked ${track.title}. It will rank lower in future sessions.`,
    skip: () => `Skipped ${track.title}. No feedback saved.`,
    undo: () => `Feedback undone. ${lookup.get(state.current).title} is back.`,
    new: () => `Session ${state.number} started. Session hides cleared.`,
  };
  showStatus(messages[action]());
  if (!state.current || action === 'undo') $('track-title').focus();
}

$('preview').addEventListener('click', playPreview);
$('new-session').addEventListener('click', () => act('new'));
$('skip').addEventListener('click', () => act('skip'));
$('undo').addEventListener('click', () => act('undo'));
$('feedback').addEventListener('click', () => {
  if (mode === 'baseline') {
    act('dislike');
    return;
  }
  const dialog = $('feedback-dialog');
  const track = lookup.get(state.current);
  $('dialog-track').textContent = mode === 'targeted' ? `${track.title} · ${track.style}` : track.title;
  $('less-label').textContent = mode === 'targeted' ? 'Recommend less of this track' : 'Recommend less';
  $('style-choice').hidden = mode !== 'targeted';
  $('style-effect').textContent = `Move all ${track.style} tracks lower in future recommendations.`;
  dialog.returnValue = 'cancel';
  dialog.showModal();
});
$('feedback-dialog').addEventListener('close', event => {
  const action = event.target.returnValue;
  if (['later', 'less', 'less-style'].includes(action)) act(action);
});
document.querySelectorAll('[name="version"]').forEach(input => {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    stopPreview();
    mode = input.value;
    state = start(profiles[mode]);
    render();
    showStatus(`${versionNames[mode]} loaded with its own feedback history.`);
  });
});
$('reset').addEventListener('click', () => {
  stopPreview();
  profiles = loadProfile();
  state = start();
  $('memory').open = false;
  saveProfile();
  render();
  showStatus('Demo reset. All feedback histories were cleared.');
});
render();
