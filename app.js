const { tracks, loadProfile, rank, start, apply } = window.Afterbeat;
const $ = id => document.getElementById(id);
const storageKey = 'afterbeat-feedback-v1';
const lookup = new Map(tracks.map(track => [track.id, track]));
let mode = 'scoped';
let profiles = loadProfile();
let audio;
let audioNodes = [];
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
  profiles[mode] = state.saved;
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
  const queue = rank(state.saved, state.hidden, excluded);
  $('queue').replaceChildren(...queue.map(track => {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = `swatch ${track.colour}`;
    swatch.setAttribute('aria-hidden', 'true');
    const name = document.createElement('strong');
    name.textContent = track.title;
    const artist = document.createElement('small');
    artist.textContent = track.artist;
    const text = document.createElement('span');
    text.append(name, artist);
    item.append(swatch, text);
    if (state.saved.includes(track.id)) {
      const tag = document.createElement('span');
      tag.className = 'queue-tag';
      tag.textContent = 'Down-ranked';
      item.append(tag);
    }
    return item;
  }));
  $('queue-count').textContent = `${queue.length} tracks`;
  $('queue-empty').hidden = queue.length > 0;
  $('queue-empty').textContent = state.current ? 'End of this queue rotation.' : 'No tracks are eligible this session.';
  const list = ids => ids.map(id => lookup.get(id).title).join(', ') || 'None';
  $('hidden-tracks').textContent = list(state.hidden);
  $('saved-tracks').textContent = list(state.saved);
}

function render() {
  const track = lookup.get(state.current);
  $('session').textContent = `Session ${state.number}`;
  $('track-title').textContent = track?.title ?? 'Session complete';
  $('track-meta').textContent = track ? `${track.artist} · ${track.style}` : 'Start a new session to hear recommendations again.';
  $('art').className = `art ${track?.colour ?? 'sage'}`;
  $('controls').hidden = !track;
  $('feedback').textContent = mode === 'scoped' ? 'Feedback' : 'Dislike';
  $('undo').hidden = !state.undo;
  renderQueue();
}

function stopPreview() {
  audioGeneration++;
  for (const node of audioNodes) {
    node.stop();
    node.disconnect();
  }
  audioNodes = [];
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
    const startTime = audio.currentTime + 0.04;
    track.notes.forEach((note, index) => {
      const onset = startTime + index * 0.41;
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      oscillator.type = index % 2 ? 'sine' : 'triangle';
      oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
      envelope.gain.setValueAtTime(0.001, onset);
      envelope.gain.exponentialRampToValueAtTime(0.12, onset + 0.045);
      envelope.gain.exponentialRampToValueAtTime(0.001, onset + 0.67);
      oscillator.connect(envelope).connect(audio.destination);
      oscillator.onended = () => envelope.disconnect();
      oscillator.start(onset);
      oscillator.stop(onset + 0.68);
      audioNodes.push(oscillator);
    });
    audioTimer = setTimeout(stopPreview, 3650);
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
  if (['less', 'dislike', 'undo'].includes(action)) saveProfile();
  render();
  const messages = {
    later: () => `${track.title} is hidden for this session.`,
    less: () => `${track.title} will rank lower in future sessions.`,
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
  $('dialog-track').textContent = lookup.get(state.current).title;
  dialog.returnValue = 'cancel';
  dialog.showModal();
});
$('feedback-dialog').addEventListener('close', event => {
  const action = event.target.returnValue;
  if (action === 'later' || action === 'less') act(action);
});
document.querySelectorAll('[name="version"]').forEach(input => {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    stopPreview();
    mode = input.value;
    state = start(profiles[mode]);
    render();
    showStatus(`${mode === 'scoped' ? 'Two choices' : 'Single dislike'} loaded with its own feedback history.`);
  });
});
$('reset').addEventListener('click', () => {
  stopPreview();
  profiles = loadProfile();
  state = start();
  $('memory').open = false;
  saveProfile();
  render();
  showStatus('Demo reset. Both feedback histories were cleared.');
});
render();
