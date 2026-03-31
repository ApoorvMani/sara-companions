const fs = require('fs');
const path = require('path');
const axios = require('axios');
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

const AdmZip = require('adm-zip');
const sharp = require('sharp');
const https = require('https');

const RAW_DIR = path.join(__dirname, 'raw');
const DOWNLOADS_DIR = path.join(RAW_DIR, 'downloads');
const SRC_CHARACTERS_DIR = path.join(__dirname, 'src', 'characters');

const SOURCES = {
  harry: 'https://www.deviantart.com/noitavlas/art/Harry-Potter-Shimeji-265354353',
  spn: 'https://www.deviantart.com/hz-ink/art/SPN-Shimeji-ZIP-file-287465926',
  bts: 'https://shimejis.xyz/directory/bts-bangtan-boys-shimeji-pack' // Actually this might be harder to scrape, let's use direct download if possible or try to scrape it.
};

// DeviantArt extraction using the window.__INITIAL_STATE__ regex
async function fetchDeviantArtDownload(url) {
  try {
    const response = await axios.get(url, { responseType: 'text' });
    // Instead of parsing the entire giant state string, just search for the download URL
    const urlMatch = /\\"download\\":\{\\"url\\":\\"(https:[^\"]+?)\\"/.exec(response.data);
    if (!urlMatch) throw new Error("Could not find download URL in DeviantArt page");
    
    let downloadUrl = urlMatch[1].replace(/\\?u002F/gi, '/').replace(/\\/g, '');
    return downloadUrl;
  } catch (err) {
    console.error(`Failed to fetch DA link for ${url}:`, err.message);
    return null;
  }
}

async function fetchBtsDirect(charName, urlName) {
    console.log(`Fetching 46 frames for ${charName} directly from shimejis.xyz...`);
    const charDir = path.join(RAW_DIR, 'bts_temp', charName);
    fs.mkdirSync(charDir, { recursive: true });
    
    for (let i = 1; i <= 46; i++) {
        const url = `https://sprite.shimejis.xyz/directory/${urlName}/img/shime${i}.png`;
        const dest = path.join(charDir, `shime${i}.png`);
        try {
            await downloadFile(url, dest);
        } catch (e) {
            console.error(`Failed to download ${url}: ${e.message}`);
        }
    }
    return charDir;
}

async function downloadFile(url, destPath) {
    console.log(`Downloading ${url} -> ${destPath}...`);
    const writer = fs.createWriteStream(destPath);
    const response = await axios.get(url, { responseType: 'stream' });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

function extractZip(zipPath, destDir) {
    console.log(`Extracting ${zipPath} -> ${destDir}...`);
    try {
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(destDir, true);
    } catch(err) {
        console.error(`Failed to extract ${zipPath}:`, err.message);
        // Fallback or skip if not zip (e.g. rar)
        if (zipPath.endsWith('.rar')) {
             console.error("WARNING: .rar not supported by adm-zip. You may need to manually extract " + zipPath);
        }
    }
}

async function processCharacterSprites(charId, sourceDir, outputDir) {
    console.log(`Processing sprites for ${charId} from ${sourceDir}...`);
    // ensure output dir
    fs.mkdirSync(outputDir, { recursive: true });

    // Find all files in sourceDir (recursively, to find where the images actually are)
    let imageFiles = [];
    const findImages = (dir) => {
        if (!fs.existsSync(dir)) return;
        fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                findImages(fullPath);
            } else if (fullPath.toLowerCase().endsWith('.png') || fullPath.toLowerCase().endsWith('.gif') || fullPath.toLowerCase().endsWith('.jpg')) {
                imageFiles.push(fullPath);
            }
        });
    }
    findImages(sourceDir);

    // Filter to known shimeji names
    const framesMap = {};
    for (const file of imageFiles) {
        let basename = path.basename(file, path.extname(file)).toLowerCase(); // 'shime1'
        let match = basename.match(/(?:shime)?(\d+)/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num >= 1 && num <= 46) {
                // Keep the shortest path or first found to avoid duplicates
                if (!framesMap[num]) {
                    framesMap[num] = file;
                }
            }
        }
    }

    // Build the frames array
    const orderedFrames = [];
    let lastValidFrame = null;
    
    // We expect exactly 46 frames
    for (let i = 1; i <= 46; i++) {
        let frameFile = framesMap[i];
        if (!frameFile) {
            console.warn(`[${charId}] Missing frame ${i}, substituting previous.`);
            frameFile = lastValidFrame;
        } else {
            lastValidFrame = frameFile;
        }
        
        if (!frameFile) {
           console.error(`[${charId}] Still missing frame ${i} and no previous frame available!`);
           return false;
        }
        orderedFrames.push(frameFile);
    }

    // Stitch them horizontally
    // Standard Shimeji frame size is 128x128
    const FRAME_SIZE = 128;
    const finalWidth = FRAME_SIZE * 46;
    const finalHeight = FRAME_SIZE;

    // Use sharp compositor
    const composites = [];
    for (let i = 0; i < 46; i++) {
        let file = orderedFrames[i];
        // Resize just in case and strictly output as PNG to preserve transparent pixels
        const buffer = await sharp(file)
            .resize(FRAME_SIZE, FRAME_SIZE, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } })
            .png()
            .toBuffer();
        composites.push({
            input: buffer,
            left: i * FRAME_SIZE,
            top: 0
        });
    }

    const spritesheetPath = path.join(outputDir, 'spritesheet.png');
    await sharp({
        create: {
            width: finalWidth,
            height: finalHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
    .composite(composites)
    .png()
    .toFile(spritesheetPath);

    // Create JSON
    const json = { frames: [] };
    for (let i = 0; i < 46; i++) {
        json.frames.push({
            x: i * FRAME_SIZE,
            y: 0,
            width: FRAME_SIZE,
            height: FRAME_SIZE
        });
    }
    
    fs.writeFileSync(path.join(outputDir, 'spritesheet.json'), JSON.stringify(json, null, 2));
    console.log(`[${charId}] Done! Compiled 46 frames to ${spritesheetPath}`);
    return true;
}

// MAIN EXECUTION
async function run() {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    
    const results = { success: [], failed: [] };

    // 1. Process Harry
    try {
        const downloads = fs.readdirSync(DOWNLOADS_DIR);
        const harryFile = downloads.find(f => f.toLowerCase().includes('harry') && (f.endsWith('.zip') || f.endsWith('.rar')));
        
        if (harryFile) {
            const harryZip = path.join(DOWNLOADS_DIR, harryFile);
            const harryRawDir = path.join(RAW_DIR, 'harry');
            
            if (harryZip.endsWith('.rar') && (!fs.existsSync(harryRawDir) || fs.readdirSync(harryRawDir).length === 0)) {
                console.error(`ERROR: ${harryFile} is a .rar file which adm-zip cannot extract.`);
                console.error(`=> Please manually extract ${harryZip} into ${harryRawDir} and run this script again.`);
                results.failed.push('harry (requires manual extraction of rar)');
            } else {
                if (!fs.existsSync(harryRawDir) || fs.readdirSync(harryRawDir).length === 0) {
                     extractZip(harryZip, harryRawDir);
                }
                let ok = await processCharacterSprites('harry', harryRawDir, path.join(SRC_CHARACTERS_DIR, 'harry'));
                if(ok) results.success.push('harry'); else results.failed.push('harry');
            }
        } else {
            console.error('Harry file not found in downloads.');
            results.failed.push('harry (not found)');
        }
    } catch(e) {
        console.error(`Error processing Harry: ${e.message}`);
        results.failed.push('harry (processing error)');
    }

    // 2. Process Supernatural
    try {
        const downloads = fs.readdirSync(DOWNLOADS_DIR);
        const spnFile = downloads.find(f => f.toLowerCase().includes('spn') && (f.endsWith('.zip') || f.endsWith('.rar')));
        
        if (spnFile) {
            const spnZip = path.join(DOWNLOADS_DIR, spnFile);
            const spnRawDir = path.join(RAW_DIR, 'spn_temp');
            
            if (spnZip.endsWith('.rar') && (!fs.existsSync(spnRawDir) || fs.readdirSync(spnRawDir).length === 0)) {
                console.error(`ERROR: ${spnFile} is a .rar file which adm-zip cannot extract.`);
                console.error(`=> Please manually extract ${spnZip} into ${spnRawDir} and run this script again.`);
                results.failed.push('spn (requires manual extraction of rar)');
            } else {
                if (!fs.existsSync(spnRawDir) || fs.readdirSync(spnRawDir).length === 0) {
                     extractZip(spnZip, spnRawDir);
                }
                
                // Process Sam, Castiel, Gabriel, Dean
                for (const char of ['sam', 'castiel', 'gabriel', 'dean']) {
                     let charDir = spnRawDir;
                     const scan = fs.readdirSync(charDir);
                     for(let f of scan) {
                        if (f.toLowerCase().includes(char)) {
                            charDir = path.join(charDir, f);
                            break;
                        }
                     }
                     
                     let ok = await processCharacterSprites(char, charDir, path.join(SRC_CHARACTERS_DIR, char));
                     if(ok) results.success.push(char); else results.failed.push(char);
                }
            }
        } else {
            console.error('SPN file not found in downloads.');
            results.failed.push('sam/castiel/gabriel (not found)');
        }
    } catch (e) {
        console.error(`Error processing SPN: ${e.message}`);
        results.failed.push('sam/castiel/gabriel (processing error)');
    }

    // 3. Download BTS (Jimin, Jungkook)
    // Instead of a zip, we can download directly from sprite.shimejis.xyz
    const btsChars = {
         jimin: 'bts-bangtan-boys-jimin-by-wyta-wolf',
         jungkook: 'bts-bangtan-boys-jungkook-kookie-baby-by-bidi-0103'
    };
    
    for (const char of Object.keys(btsChars)) {
         try {
             let charDir = await fetchBtsDirect(char, btsChars[char]);
             let ok = await processCharacterSprites(`bts_${char}`, charDir, path.join(SRC_CHARACTERS_DIR, char === 'jimin' ? 'jimin' : `bts_${char}`));
             if(ok) results.success.push(`bts_${char}`); else results.failed.push(`bts_${char}`);
         } catch(e) {
             console.error(`Error processing BTS ${char}: ${e.message}`);
             results.failed.push(`bts_${char}`);
         }
    }

    console.log("=========================================");
    console.log("FINAL REPORT:");
    console.log("Success:", results.success);
    console.log("Failed:", results.failed);
}

run().catch(console.error);

