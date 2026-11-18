const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.AFTERBEAT_PLAYWRIGHT ?? 'playwright');

const url = pathToFileURL(path.join(__dirname, 'index.html')).href;
const figures = process.env.AFTERBEAT_SCREENSHOTS;
if (figures) fs.mkdirSync(figures, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.AFTERBEAT_BROWSER,
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 880 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    const button = name => page.getByRole('button', { name, exact: true });
    const radio = name => page.getByText(name, { exact: true });
    const text = selector => page.locator(selector).textContent();
    const waitForStatus = value => page.getByText(value, { exact: true }).waitFor();
    const track = async expected => assert.equal(await text('#track-title'), expected);
    const queueTitles = () => page.locator('#queue li strong').allTextContents();
    const photo = async (name, subject = page) => {
      if (figures) await subject.screenshot({ path: path.join(figures, name + '.png'), animations: 'disabled' });
    };
    const reset = async () => {
      await button('Reset demo').click();
      await page.reload();
    };

    await page.goto(url);
    await reset();
    await track('Glass Hour');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    const previews = await page.evaluate(async () => {
      const sampleRate = 22050;
      const rendered = [];
      for (const track of window.Afterbeat.tracks) {
        const context = new OfflineAudioContext(2, sampleRate * 13, sampleRate);
        const clip = window.AfterbeatMusic.schedule(context, track);
        const buffer = await context.startRendering();
        const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
        let peak = 0;
        let tail = 0;
        for (const samples of channels) {
          for (let i = 0; i < samples.length; i++) {
            const magnitude = Math.abs(samples[i]);
            peak = Math.max(peak, magnitude);
            if (i / sampleRate > clip.duration + 0.1) tail = Math.max(tail, magnitude);
          }
        }
        rendered.push({ style: track.style, duration: clip.duration, peak, tail });
      }
      return rendered;
    });
    assert.deepEqual(previews.map(clip => clip.style).sort(), [
      'Ambient', 'Ambient', 'Chillhop', 'Chillhop', 'Synth pop', 'Synth pop',
    ]);
    assert.ok(previews.every(clip => clip.duration >= 8 && clip.duration <= 12 &&
      clip.peak > 0.025 && clip.peak < 1 && clip.tail < 0.0001));
    await button('Play demo clip').click();
    await button('Stop clip').waitFor();
    await page.waitForTimeout(175);
    assert.equal(await text('#status'), '');
    await button('Stop clip').click();
    await button('Play demo clip').waitFor();
    await button('Feedback').click();
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Cancel');
    await page.keyboard.press('Escape');
    await track('Glass Hour');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'feedback');
    assert.equal(await text('#saved-tracks'), 'None');
    await button('Feedback').click();
    assert.equal(await page.getByRole('button', { name: /Recommend less of this style/ }).count(), 0);
    await photo('a1-choice');
    await page.getByRole('button', { name: /Not now/ }).click();
    await waitForStatus('Glass Hour is hidden for this session.');
    await track('Paper Moon');
    assert.equal(await text('#hidden-tracks'), 'Glass Hour');
    assert.equal(await text('#saved-tracks'), 'None');
    await photo('a2-hidden');
    await button('New session').click();
    await track('Glass Hour');
    await photo('a3-return');
    await reset();

    await button('Feedback').click();
    await page.getByRole('button', { name: /Recommend less/ }).click();
    await waitForStatus('Glass Hour will rank lower in future sessions.');
    await track('Paper Moon');
    assert.equal(await text('#saved-tracks'), 'Glass Hour');
    await photo('b1-saved');
    await button('New session').click();
    await track('Paper Moon');
    const scopedQueue = await queueTitles();
    assert.equal(scopedQueue.at(-1), 'Glass Hour');
    await photo('b2-ranked');
    await page.reload();
    await track('Paper Moon');
    assert.equal(await text('#saved-tracks'), 'Glass Hour');
    await radio('Single dislike').click();
    await track('Glass Hour');
    assert.equal(await text('#saved-tracks'), 'None');
    await photo('c1-baseline');
    await button('Dislike').click();
    await waitForStatus('Disliked Glass Hour. It will rank lower in future sessions.');
    await track('Paper Moon');
    assert.equal(await text('#saved-tracks'), 'Glass Hour');
    await photo('c2-dislike');
    await button('Undo').click();
    await track('Glass Hour');
    assert.equal(await text('#saved-tracks'), 'None');
    await photo('c3-undo');
    await button('Dislike').click();
    await button('New session').click();
    await track('Paper Moon');
    assert.deepEqual(await queueTitles(), scopedQueue);
    await radio('Two choices').click();
    await track('Paper Moon');
    assert.equal(await text('#saved-tracks'), 'Glass Hour');

    const styleOption = page.getByRole('button', { name: /Recommend less of this style/ });
    const styleQueue = ['Second Signal', 'Open Window', 'City After Rain', 'Glass Hour', 'Low Tide'];
    const queuePanel = page.getByRole('region', { name: 'Up next' });
    await radio('Track or style').click();
    await track('Glass Hour');
    await button('Feedback').click();
    assert.match(await styleOption.textContent(), /Move all Ambient tracks/);
    await photo('d1-target', page.getByRole('dialog'));
    await page.getByRole('button', { name: /Recommend less of this track/ }).click();
    await waitForStatus('Glass Hour will rank lower in future sessions.');
    await button('New session').click();
    assert.deepEqual(await queueTitles(), scopedQueue);
    assert.deepEqual(await page.locator('.queue-tag').allTextContents(), ['Down-ranked']);
    assert.equal(await text('#saved-styles'), 'None');
    await photo('d2-track', queuePanel);

    await reset();
    await radio('Track or style').click();
    await button('Feedback').click();
    await styleOption.click();
    await waitForStatus('Ambient tracks will rank lower in future sessions.');
    assert.equal(await text('#saved-tracks'), 'None');
    assert.equal(await text('#saved-styles'), 'Ambient');
    await button('Undo').click();
    await track('Glass Hour');
    assert.equal(await text('#saved-styles'), 'None');
    await button('Feedback').click();
    await styleOption.click();
    await waitForStatus('Ambient tracks will rank lower in future sessions.');
    await button('New session').click();
    assert.deepEqual(await queueTitles(), styleQueue);
    assert.deepEqual(await page.locator('.queue-tag').allTextContents(), ['Style down-ranked', 'Style down-ranked']);
    await photo('d3-style', queuePanel);
    await page.reload();
    await track('Glass Hour');
    await radio('Track or style').click();
    await track('Paper Moon');
    assert.deepEqual(await queueTitles(), styleQueue);

    await reset();
    await track('Glass Hour');
    await button('Skip').click();
    await track('Paper Moon');
    assert.equal(await text('#saved-tracks'), 'None');
    await button('New session').click();
    await track('Glass Hour');

    for (let i = 0; i < 6; i++) {
      const hiddenTitle = await text('#track-title');
      await button('Feedback').click();
      await page.getByRole('button', { name: /Not now/ }).click();
      await waitForStatus(`${hiddenTitle} is hidden for this session.`);
    }
    await track('Session complete');
    await button('Undo').click();
    await track('City After Rain');
    assert.deepEqual(errors, []);

    const blocked = await browser.newPage({ viewport: { width: 320, height: 700 } });
    await blocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
    });
    await blocked.goto(url);
    assert.equal(await blocked.evaluate(() => document.documentElement.scrollWidth), 320);
    await blocked.getByRole('button', { name: 'Feedback', exact: true }).click();
    await blocked.getByRole('button', { name: /Recommend less/ }).click();
    await blocked.getByText('Glass Hour will rank lower in future sessions.').waitFor();
    await blocked.getByRole('button', { name: 'New session', exact: true }).click();
    assert.equal(await blocked.locator('#track-title').innerText(), 'Paper Moon');
    assert.equal(await blocked.locator('#storage-note').isVisible(), true);
    await blocked.reload();
    assert.equal(await blocked.locator('#track-title').innerText(), 'Glass Hour');
    console.log(figures ? 'Browser replay passed. Eleven storyboard frames captured.' : 'Browser replay passed.');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
