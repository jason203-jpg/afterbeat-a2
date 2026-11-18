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
    const photo = async name => {
      if (figures) await page.screenshot({ path: path.join(figures, name + '.png'), animations: 'disabled' });
    };
    const reset = async () => {
      await button('Reset demo').click();
      await page.reload();
    };

    await page.goto(url);
    await reset();
    await track('Glass Hour');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
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
    assert.equal(await page.locator('#queue li').last().locator('strong').innerText(), 'Glass Hour');
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
    await radio('Two choices').click();
    await track('Paper Moon');
    assert.equal(await text('#saved-tracks'), 'Glass Hour');
    await reset();
    await track('Glass Hour');
    await button('Skip').click();
    await track('Paper Moon');
    assert.equal(await text('#saved-tracks'), 'None');
    await button('New session').click();
    await track('Glass Hour');

    for (let i = 0; i < 6; i++) {
      await button('Feedback').click();
      await page.getByRole('button', { name: /Not now/ }).click();
      await page.getByText(/is hidden for this session/).waitFor();
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
    console.log(figures ? 'Browser replay passed. Eight storyboard frames captured.' : 'Browser replay passed.');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
