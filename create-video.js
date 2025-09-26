const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');

// --- AYARLAR ---
const SVG_URL = 'https://raw.githubusercontent.com/rvoidex7/rvoidex7/output/github-contribution-grid-snake-dark.svg';
const FRAMES_DIR = path.join(__dirname, 'frames');
const VIDEO_DURATION_SECONDS = 35; // Videonun son uzunluğu (orijinal animasyon süresi)
const FRAME_RATE = 30;
const SLOWDOWN_FACTOR = 20; // Animasyonu ne kadar yavaşlatacağımız (5 kat yavaşlat)

const TOTAL_FRAMES_TO_CAPTURE = VIDEO_DURATION_SECONDS * FRAME_RATE;

// Instagram Panoramik Çözünürlüğü (Oranı ~4.74:1)
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
    // 'dur="<sayı>s"' formatındaki tüm süreleri bul ve faktör ile çarp
    return svgContent.replace(/dur="(\d*\.?\d+)s"/g, (match, seconds) => {
        const originalDuration = parseFloat(seconds);
        const newDuration = originalDuration * factor;
        return `dur="${newDuration.toFixed(4)}s"`;
    });
}

// --- ANA FONKSİYON ---
async function createVideo() {
    console.log('Video oluşturma süreci başlatılıyor...');

    // 1. Gerekli klasörü oluştur
    if (fs.existsSync(FRAMES_DIR)) {
        fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(FRAMES_DIR);
    console.log(`'${FRAMES_DIR}' klasörü oluşturuldu.`);

    // 2. SVG içeriğini internetten çek ve yavaşlat
    console.log(`SVG içeriği şu adresten çekiliyor: ${SVG_URL}`);
    let svgContent = await fetchUrlContent(SVG_URL);
    svgContent = slowDownSvgAnimation(svgContent, SLOWDOWN_FACTOR);
    console.log('SVG içeriği çekildi ve yavaşlatıldı.');

    // 3. Yavaşlatılmış SVG'yi HTML'e yerleştir
    const htmlContent = `
        <!DOCTYPE html>
        <html><head><style>body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #0D1117; } svg { width: 100%; height: 100%; object-fit: contain; }</style></head>
        <body>${svgContent}</body></html>`;

    // 4. Puppeteer'ı başlat
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT });
    console.log('Tarayıcı başlatıldı.');

    // 5. Yavaşlatılmış animasyonu içeren HTML'i yükle ve kareleri yakala
    await page.setContent(htmlContent);
    // Sayfanın ve animasyonun yüklenmesi için kısa bir bekleme süresi ekleyelim
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    console.log('Yavaşlatılmış animasyon yüklendi. Gerçek zamanlı kare yakalama başlıyor...');
    
    for (let i = 0; i < TOTAL_FRAMES_TO_CAPTURE; i++) {
        const framePath = path.join(FRAMES_DIR, `frame-${String(i).padStart(4, '0')}.png`);
        await page.screenshot({ path: framePath });
        process.stdout.write(`Kare yakalandı: ${i + 1}/${TOTAL_FRAMES_TO_CAPTURE}\r`);
    }

    console.log('\nTüm kareler başarıyla yakalandı.');
    await browser.close();

    // 6. FFmpeg ile videoyu oluştur
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
        console.log('🖼️ Kareler incelenmek üzere "frames" klasöründe bırakıldı.');
        console.log('-----------------------------------------');
        
        // --- İSTEĞİN ÜZERİNE BU SATIR YORUMA ALINDI ---
        // fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
        // console.log('Geçici kareler klasörü temizlendi.');
    });
}

createVideo();