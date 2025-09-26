const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');

// --- AYARLAR ---

// 1. Ekran Kartınıza Göre Video Kodeğini Seçin
// 'libx264'   -> İşlemci (CPU) kullanır. En uyumlu ama en yavaş olanıdır.
// 'h264_nvenc' -> NVIDIA ekran kartları için. (Önerilen)
// 'h264_amf'   -> AMD ekran kartları için.
// 'h264_qsv'   -> Intel dahili grafikler için.
const VIDEO_CODEC = 'h264_nvenc'; // <--- KENDİ EKRAN KARTINA GÖRE BURAYI DEĞİŞTİR

const SVG_URL = 'https://raw.githubusercontent.com/rvoidex7/rvoidex7/output/github-contribution-grid-snake-dark.svg';
const FRAMES_DIR = path.join(__dirname, 'frames');
const VIDEO_DURATION_SECONDS = 35; 
const FRAME_RATE = 30;
const SLOWDOWN_FACTOR = 10; // Animasyon hızı hala fazlaysa bu değeri arttır.

const TOTAL_FRAMES_TO_CAPTURE = VIDEO_DURATION_SECONDS * FRAME_RATE;

// Instagram Panoramik Çözünürlüğü
const OUTPUT_WIDTH = 2048;
const OUTPUT_HEIGHT = 432;

// --- YARDIMCI FONKSİYONLAR ---
function fetchUrlContent(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', (err) => reject(err));
    });
}

function slowDownSvgAnimation(svgContent, factor) {
    console.log(`Animasyon ${factor} kat yavaşlatılıyor...`);
    return svgContent.replace(/dur="(\d*\.?\d+)s"/g, (match, seconds) => {
        const newDuration = parseFloat(seconds) * factor;
        return `dur="${newDuration.toFixed(4)}s"`;
    });
}

// --- ANA FONKSİYON ---
async function createVideo() {
    console.log('Video oluşturma süreci başlatılıyor...');
    if (fs.existsSync(FRAMES_DIR)) {
        fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(FRAMES_DIR);
    console.log(`'${FRAMES_DIR}' klasörü oluşturuldu.`);

    console.log(`SVG içeriği şu adresten çekiliyor: ${SVG_URL}`);
    let svgContent = await fetchUrlContent(SVG_URL);
    svgContent = slowDownSvgAnimation(svgContent, SLOWDOWN_FACTOR);
    console.log('SVG içeriği çekildi ve yavaşlatıldı.');

    const htmlContent = `<!DOCTYPE html><html><head><style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #0D1117; } svg { width: 100%; height: 100%; object-fit: contain; }</style></head><body>${svgContent}</body></html>`;

    console.log('Tarayıcı başlatılıyor (Puppeteer)...');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT });

    console.log('Yavaşlatılmış animasyon yükleniyor...');
    await page.setContent(htmlContent);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Gerçek zamanlı kare yakalama başlıyor...');

    for (let i = 0; i < TOTAL_FRAMES_TO_CAPTURE; i++) {
        const framePath = path.join(FRAMES_DIR, `frame-${String(i).padStart(4, '0')}.png`);
        await page.screenshot({ path: framePath });
        process.stdout.write(`Kare yakalandı: ${i + 1}/${TOTAL_FRAMES_TO_CAPTURE}\r`);
    }

    console.log('\nTüm kareler başarıyla yakalandı.');
    await browser.close();

    console.log(`FFmpeg ile video birleştiriliyor... (Kodek: ${VIDEO_CODEC})`);
    const ffmpegPath = require('ffmpeg-static');
    const command = `"${ffmpegPath}" -framerate ${FRAME_RATE} -i "${FRAMES_DIR}/frame-%04d.png" -c:v ${VIDEO_CODEC} -pix_fmt yuv420p -crf 23 -y output.mp4`;

    exec(command, (error) => {
        if (error) {
            console.error(`\nFFmpeg hatası: ${error.message}`);
            console.error('Lütfen doğru ekran kartı kodeğini seçtiğinizden ve sürücülerinizin güncel olduğundan emin olun.');
            return;
        }
        console.log('\n-----------------------------------------');
        console.log('✅ Video başarıyla ve GPU hızlandırma ile oluşturuldu: output.mp4');
        console.log('🖼️ Kareler incelenmek üzere "frames" klasöründe bırakıldı.');
        console.log('-----------------------------------------');
    });
}

createVideo();