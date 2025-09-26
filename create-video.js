// Gerekli kütüphaneleri içeri aktar
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Ayarlar
const HTML_FILE_PATH = `file://${path.join(__dirname, 'index.html')}`; // index.html dosyasının tam yolu
const FRAMES_DIR = path.join(__dirname, 'frames'); // Karelerin kaydedileceği klasör
const VIDEO_DURATION_SECONDS = 15; // Videonun toplam uzunluğu (saniye)
const FRAME_RATE = 30; // Saniyedeki kare sayısı (FPS)
const TOTAL_FRAMES = VIDEO_DURATION_SECONDS * FRAME_RATE;

// Çıktı video ayarları (Instagram panoramik oranına yakın)
const OUTPUT_WIDTH = 1920;
const OUTPUT_HEIGHT = 405; // 5120x1080 ile aynı oran (yaklaşık 4.74:1)

async function createVideo() {
    console.log('Video oluşturma süreci başlatılıyor...');

    // 1. Kareleri kaydetmek için klasörü oluştur (varsa içini boşalt)
    if (fs.existsSync(FRAMES_DIR)) {
        fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(FRAMES_DIR);
    console.log(`'${FRAMES_DIR}' klasörü oluşturuldu.`);

    // 2. Puppeteer ile headless tarayıcıyı başlat
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT });
    console.log('Tarayıcı başlatıldı ve sayfa boyutu ayarlandı.');

    // 3. index.html dosyasını aç
    await page.goto(HTML_FILE_PATH, { waitUntil: 'networkidle0' });
    console.log('HTML dosyası yüklendi. Kareler yakalanıyor...');

    // 4. Belirlenen süre boyunca ekran görüntülerini yakala
    for (let i = 0; i < TOTAL_FRAMES; i++) {
        const framePath = path.join(FRAMES_DIR, `frame-${String(i).padStart(4, '0')}.png`);
        await page.screenshot({ path: framePath });
        process.stdout.write(`Kare yakalandı: ${i + 1}/${TOTAL_FRAMES}\r`);
    }
    
    console.log('\nTüm kareler başarıyla yakalandı.');
    await browser.close();

    // 5. FFmpeg ile karelerden videoyu oluştur
    console.log('FFmpeg ile video birleştiriliyor... Bu işlem biraz sürebilir.');
    const ffmpegPath = require('ffmpeg-static');
    const command = `"${ffmpegPath}" -framerate ${FRAME_RATE} -i "${FRAMES_DIR}/frame-%04d.png" -c:v libx264 -pix_fmt yuv420p -crf 23 -y output.mp4`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`FFmpeg hatası: ${error.message}`);
            return;
        }
        console.log('-----------------------------------------');
        console.log('✅ Video başarıyla oluşturuldu: output.mp4');
        console.log('-----------------------------------------');

        // 6. Geçici kareler klasörünü sil
        fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
        console.log('Geçici kareler klasörü temizlendi.');
    });
}

createVideo();