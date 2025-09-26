const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');

// --- AYARLAR ---
const SVG_URL = 'https://raw.githubusercontent.com/rvoidex7/rvoidex7/output/github-contribution-grid-snake-dark.svg';
const FRAMES_DIR = path.join(__dirname, 'frames');
const VIDEO_DURATION_SECONDS = 35; // Animasyonun toplam süresi
const FRAME_RATE = 60; // Saniyedeki kare sayısı (FPS)
const TOTAL_FRAMES = VIDEO_DURATION_SECONDS * FRAME_RATE;

// Instagram Panoramik Çözünürlüğü (Oranı ~4.74:1)
// Yüksekliğin çift sayı olması önemli!
const OUTPUT_WIDTH = 2048; 
const OUTPUT_HEIGHT = 432; 

// --- ANA FONKSİYON ---

// URL'den içerik çekmek için yardımcı fonksiyon
function fetchUrlContent(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', (err) => reject(err));
    });
}

async function createVideo() {
    console.log('Video oluşturma süreci başlatılıyor...');

    // 1. Gerekli klasörü oluştur
    if (fs.existsSync(FRAMES_DIR)) {
        fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(FRAMES_DIR);
    console.log(`'${FRAMES_DIR}' klasörü oluşturuldu.`);

    // 2. SVG içeriğini internetten çek
    console.log(`SVG içeriği şu adresten çekiliyor: ${SVG_URL}`);
    const svgContent = await fetchUrlContent(SVG_URL);
    console.log('SVG içeriği başarıyla çekildi.');

    // 3. SVG'yi içine yerleştireceğimiz HTML yapısını oluştur
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #0D1117; }
                svg { width: 100%; height: 100%; object-fit: contain; }
            </style>
        </head>
        <body>
            ${svgContent}
        </body>
        </html>`;

    // 4. Puppeteer ile tarayıcıyı başlat
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT });
    console.log('Tarayıcı başlatıldı ve sayfa boyutu ayarlandı.');

    // 5. Oluşturduğumuz HTML'i sayfaya yükle
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    console.log('HTML ve SVG sayfaya yüklendi. Animasyon kontrol ediliyor...');

    // 6. Animasyonu durdur ve kare kare kontrol etmeye başla
    await page.evaluate(() => {
        document.querySelector('svg').pauseAnimations();
    });
    console.log('Animasyon duraklatıldı. Kareler yakalanıyor...');

    for (let i = 0; i < TOTAL_FRAMES; i++) {
        const currentTime = i / FRAME_RATE;
        await page.evaluate((time) => {
            document.querySelector('svg').setCurrentTime(time);
        }, currentTime);

        const framePath = path.join(FRAMES_DIR, `frame-${String(i).padStart(4, '0')}.png`);
        await page.screenshot({ path: framePath });
        process.stdout.write(`Kare yakalandı: ${i + 1}/${TOTAL_FRAMES}\r`);
    }

    console.log('\nTüm kareler başarıyla yakalandı.');
    await browser.close();

    // 7. FFmpeg ile videoyu oluştur
    console.log('FFmpeg ile video birleştiriliyor... Bu işlem biraz sürebilir.');
    const ffmpegPath = require('ffmpeg-static');
    const command = `"${ffmpegPath}" -framerate ${FRAME_RATE} -i "${FRAMES_DIR}/frame-%04d.png" -c:v libx264 -pix_fmt yuv420p -crf 23 -y output.mp4`;

    exec(command, (error) => {
        if (error) {
            console.error(`FFmpeg hatası: ${error.message}`);
            return;
        }
        console.log('-----------------------------------------');
        console.log('✅ Video başarıyla oluşturuldu: output.mp4');
        console.log('-----------------------------------------');

        // Geçici klasörü temizle
        fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
        console.log('Geçici kareler klasörü temizlendi.');
    });
}

createVideo();