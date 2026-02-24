import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent('<h1>Hello World</h1>');
    await page.pdf({ path: 'test.pdf' });
    await browser.close();
    console.log('PDF created successfully');
  } catch (e) {
    console.error('Error:', e);
  }
})();
