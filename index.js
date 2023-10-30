const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { Cluster } = require('puppeteer-cluster');
const { replaceInvalidChars, getFilenameFromLevels, getIndentLevel, getLevelsFromFilename, sleep } = require('./util');

const puppeteerOptions = {
    headless: 'new',
    userDataDir: String.raw`D:\Desktop\webpage2pdf`,
    defaultViewport: {
        width: 1920,
        // 为了让页面加载完整
        // height: 1080,
        height: 100_0000,
    },
    // executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
    args: [
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
        '--autoplay-policy=user-gesture-required',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-dev-shm-usage',
        '--disable-domain-reliability',
        '--disable-extensions',
        '--disable-features=AudioServiceOutOfProcess',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-notifications',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-popup-blocking',
        '--disable-print-preview',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--disable-setuid-sandbox',
        '--disable-speech-api',
        '--disable-sync',
        '--hide-scrollbars',
        '--ignore-gpu-blacklist',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--no-first-run',
        '--no-pings',
        '--no-sandbox',
        '--no-zygote',
        '--password-store=basic',
        '--use-gl=swiftshader',
        '--use-mock-keychain',
        // 代理设置
        '--proxy-server=127.0.0.1:17890',
        // disable the Same-origin policy，用 js 访问 iframe 时需要
        // https://stackoverflow.com/questions/3102819/disable-same-origin-policy-in-chrome
        '--disable-web-security',
        '--disable-site-isolation-trials',
    ]
};

async function parseFile(inputFile) {
    const file = await fs.readFile(inputFile, 'utf8');
    const lines = file.split('\n');
    const dirName = path.parse(inputFile).name;
    try {
        await fs.access(dirName);
    } catch (e) {
        await fs.mkdir(dirName);
    }

    let levels = [];
    let js = '';
    let inputList = [];

    for (let line of lines) {
        const currLevel = getIndentLevel(line) + 1;
        line = line.trim();
        if (line === '' || line.startsWith('*')) continue;

        if (line.startsWith('!')) {
            js += line.slice(1).trim();
            continue;
        }

        const prevLevel = levels.length;

        if (currLevel > prevLevel) {
            levels.push(...Array(currLevel - prevLevel - 1).fill(1), 0);
        } else if (currLevel < prevLevel) {
            levels = levels.slice(0, currLevel);
        }

        levels[levels.length - 1]++;

        if (line.startsWith('#')) continue;

        let [url, filename] = line.split('\t');
        if (!filename) {
            filename = url.split('/').pop().replace(/-/g, ' ');
        }

        filename = getFilenameFromLevels(filename, levels);
        filename = replaceInvalidChars(filename);
        inputList.push([url, filename]);
    }

    return { inputList, js, dirName };
}

async function cluster(inputFile) {
    const {inputList, js, dirName} = await parseFile(inputFile);
    const cluster = await Cluster.launch({
        puppeteerOptions: puppeteerOptions,
        concurrency: Cluster.CONCURRENCY_PAGE,
        maxConcurrency: 1,
        retryLimit: 10,
        monitor: true,
    });

    cluster.on('taskerror', (err, data, willRetry) => {
        data[2]++;
        let [url, filename, errors] = data;
        if (willRetry) {
            console.warn(`Retry[${errors}] ${url} <${filename}>: ${err.message}`);
        } else {
            console.error(`Failed[${errors}] ${url} <${filename}>: ${err.message}`);
        }
    });

    for (let data of inputList) {
        data.push(0);   // error 计数
        await cluster.queue(data);
    }

    await cluster.task(async ({ page, data: [url, filename, errors] }) => {
        await page.goto(url, { waitUntil: errors < 5 ? 'networkidle0' : 'networkidle2' });
        if (getLevelsFromFilename(filename).length === 3) {
            await page.waitForFrame(
                async frame => {
                    return frame.name().startsWith('dsq-');
                }
            )
        }
        // iframe 等待加载的时间
        await sleep(2000);
        await page.evaluate(js);
        // iframe 里的元素被删除后，需要等一下高度才能变小
        await sleep(2000);

        await page.pdf({
            format: 'a4',
            printBackground: true,
            margin: { top: '0mm', right: '5mm', bottom: '0mm', left: '5mm' },
            scale: 1,
            path: `${dirName}/${filename}.pdf`,
        });
    });

    await cluster.idle();
    await cluster.close();
}


(async () => {
    await cluster('configs\\test.txt');
    // await cluster('configs\\The Modern JavaScript Tutorial.txt');
})();
