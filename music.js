/* Original instrumental previews rendered by Web Audio. */
(function (root) {
  const noiseBuffers = new WeakMap();
  const layouts = {
    Ambient: ambient,
    'Synth pop': synthPop,
    Chillhop: chillhop,
  };

  function frequency(note) {
    return 440 * 2 ** ((note - 69) / 12);
  }

  function noiseBuffer(context) {
    if (!noiseBuffers.has(context)) {
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.32), context.sampleRate);
      const samples = buffer.getChannelData(0);
      let seed = 6435135;
      for (let index = 0; index < samples.length; index++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        samples[index] = (seed >>> 0) / 2147483648 - 1;
      }
      noiseBuffers.set(context, buffer);
    }
    return noiseBuffers.get(context);
  }

  function schedule(context, track) {
    const start = context.currentTime + 0.04;
    const mix = context.createGain();
    const active = new Set();
    let connected = true;
    let stopped = false;
    mix.gain.value = 0.72;
    mix.connect(context.destination);

    function disconnectMix() {
      if (connected) mix.disconnect();
      connected = false;
    }

    function play(source, offset, length, level, { attack = 0.008, release = 0.13, filter, pan = 0 } = {}) {
      const onset = start + offset;
      const end = onset + length;
      const gain = context.createGain();
      const crest = onset + Math.min(attack, length * 0.4);
      const decay = Math.max(crest, end - release);
      gain.gain.setValueAtTime(0, onset);
      gain.gain.linearRampToValueAtTime(level, crest);
      gain.gain.setValueAtTime(level, decay);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      source.connect(gain);
      let output = gain;
      const chain = [gain];
      if (filter) {
        const shaped = context.createBiquadFilter();
        shaped.type = filter.type;
        shaped.frequency.value = filter.frequency;
        shaped.Q.value = 0.68;
        output.connect(shaped);
        output = shaped;
        chain.push(shaped);
      }
      if (pan && typeof context.createStereoPanner === 'function') {
        const panner = context.createStereoPanner();
        panner.pan.value = pan;
        output.connect(panner);
        output = panner;
        chain.push(panner);
      }
      output.connect(mix);
      active.add(source);
      source.onended = () => {
        active.delete(source);
        source.disconnect();
        for (const node of chain) node.disconnect();
        if (!active.size) disconnectMix();
      };
      source.start(onset);
      source.stop(end);
    }

    function tone(offset, note, length, level, type = 'sine', voice = {}) {
      const source = context.createOscillator();
      source.type = type;
      source.frequency.value = frequency(note);
      if (voice.glideTo !== undefined) {
        source.frequency.setValueAtTime(frequency(note), start + offset);
        source.frequency.exponentialRampToValueAtTime(frequency(voice.glideTo), start + offset + voice.glideTime);
      }
      play(source, offset, length, level, voice);
    }

    function noise(offset, length, level, type, cutoff) {
      const source = context.createBufferSource();
      source.buffer = noiseBuffer(context);
      play(source, offset, length, level, {
        attack: 0.002,
        release: length * 0.89,
        filter: { type, frequency: cutoff },
      });
    }

    const arrange = layouts[track.style];
    if (!arrange) {
      disconnectMix();
      throw new RangeError('Unsupported preview style');
    }
    const duration = arrange({ tone, noise }, track) + 0.05;

    function stop() {
      if (stopped || !connected) return;
      stopped = true;
      const fadeEnd = context.currentTime + 0.02;
      mix.gain.linearRampToValueAtTime(0, fadeEnd);
      for (const source of active) source.stop(fadeEnd);
    }

    return { duration, stop };
  }

  function ambient({ tone }, track) {
    const root = track.notes[0];
    const harmonies = track.id === 'tide'
      ? [[0, 3, 7, 14], [5, 8, 12, 15], [-2, 2, 5, 9], [0, 3, 7, 12]]
      : [[0, 3, 7, 14], [-4, 0, 3, 7], [5, 8, 12, 15], [0, 3, 7, 12]];

    harmonies.forEach((chord, section) => {
      const onset = section * 2.45;
      const length = section === 3 ? 2.55 : 3.0;
      tone(onset, root + chord[0] - 12, length, 0.08, 'sine', { attack: 0.72, release: 0.82 });
      chord.forEach((step, voice) => {
        tone(onset + voice * 0.085, root + step, length, voice === 2 ? 0.028 : 0.038, 'sine', {
          attack: 0.93,
          release: 0.95,
          pan: [-0.5, 0.32, -0.2, 0.52][voice],
        });
      });
    });
    const onsets = [0.84, 1.94, 3.18, 4.46, 5.82, 6.96, 8.12, 9.03];
    onsets.forEach((onset, index) => {
      const note = track.notes[index] + 12;
      tone(onset, note, 1.02, 0.06, 'triangle', { attack: 0.04, release: 0.91, pan: -0.28 });
      tone(onset + 0.31, note + 12, 0.85, 0.018, 'sine', { attack: 0.05, release: 0.77, pan: 0.4 });
    });
    return 10.35;
  }

  function synthPop({ tone, noise }, track) {
    const beat = 60 / (track.id === 'signal' ? 120 : 112);
    const root = track.notes[0];
    const chords = track.id === 'signal'
      ? [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]]
      : [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]];
    const bright = { type: 'lowpass', frequency: 1850 };

    chords.forEach((chord, bar) => {
      const downbeat = bar * 4 * beat;
      for (let index = 0; index < 4; index++) {
        const onset = downbeat + index * beat;
        tone(onset, 43, 0.22, 0.193, 'sine', { glideTo: 26, glideTime: 0.085, release: 0.21 });
        noise(onset + beat * 0.5, 0.084, 0.032, 'highpass', 7000);
        if (index % 2 === 1) noise(onset, 0.145, 0.15, 'bandpass', 2130);
        tone(onset + beat * 0.075, root + chord[0] - 12, beat * 0.38, 0.102, 'triangle');
        tone(onset + beat * 0.59, root + chord[index % chord.length] - 12, beat * 0.29, 0.062, 'square', { filter: { type: 'lowpass', frequency: 650 } });
      }
      for (const pulse of [0.52, 2.52]) {
        chord.forEach((step, voice) => {
          tone(downbeat + beat * pulse, root + step + 12, beat * 0.58, 0.028, 'sawtooth', {
            filter: bright,
            pan: (voice - 1) * 0.53,
          });
        });
      }
      [0, 0.75, 1.5, 2.25, 3.25].forEach((pulse, index) => {
        const note = track.notes[(bar * 2 + index) % track.notes.length] + 12;
        tone(downbeat + beat * pulse, note, beat * 0.52, index === 0 ? 0.076 : 0.052, 'triangle', { pan: 0.12 });
      });
    });
    return beat * 16 + 0.2;
  }

  function chillhop({ tone, noise }, track) {
    const beat = 60 / (track.id === 'city' ? 88 : 92);
    const root = track.notes[0];
    const chords = track.id === 'city'
      ? [[0, 3, 7, 10], [-2, 2, 5, 9], [-5, -2, 2, 5], [-7, -3, 0, 3]]
      : [[0, 4, 7, 11], [-3, 0, 4, 7], [2, 5, 9, 12], [-5, -1, 2, 5]];

    chords.forEach((chord, bar) => {
      const downbeat = bar * 4 * beat;
      for (const offbeat of [0, 0.59, 1.59, 2, 2.59, 3.59]) {
        noise(downbeat + beat * offbeat, 0.062, offbeat % 1 ? 0.033 : 0.02, 'highpass', 5800);
      }
      for (const pulse of [0, bar % 2 ? 1.61 : 2.57]) {
        tone(downbeat + beat * pulse, 39, 0.23, 0.21, 'sine', { glideTo: 26, glideTime: 0.065, release: 0.22 });
      }
      for (const pulse of [1.04, 3.04]) {
        noise(downbeat + beat * pulse, 0.14, 0.107, 'bandpass', 1560);
        tone(downbeat + beat * pulse, 56, 0.105, 0.045, 'triangle', { release: 0.094 });
      }
      for (const pulse of [0.04, 2.59]) {
        chord.forEach((step, voice) => {
          const onset = downbeat + beat * (pulse + voice * 0.031);
          tone(onset, root + step, beat * 0.95, 0.054, 'sine', { release: beat * 0.71, pan: (voice - 1.5) * 0.22 });
          tone(onset, root + step + 12, beat * 0.46, 0.015, 'triangle', { release: beat * 0.4 });
        });
      }
      tone(downbeat + 0.04, root + chord[0] - 12, beat * 1.22, 0.125, 'sine', { release: beat * 0.53 });
      tone(downbeat + beat * 2.59, root + chord[2] - 12, beat * 0.86, 0.081, 'sine', { release: beat * 0.37 });
      [0.59, 1.54, 3.12].forEach((pulse, index) => {
        const note = track.notes[(bar * 2 + index) % track.notes.length] + 12;
        tone(downbeat + beat * pulse, note, beat * 0.54, 0.050, 'triangle', { release: beat * 0.43, pan: 0.27 });
      });
    });
    return beat * 16 + 0.2;
  }

  root.AfterbeatMusic = { schedule };
})(window);
