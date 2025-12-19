const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const IMAGES_DIR = path.join(__dirname, 'images');
const OUTPUT_DIR = path.join(__dirname, 'flickr');

function checkExifTool() {
  try {
    execSync('which exiftool', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }
}

function sanitizeFolderName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .trim();
}

function ensureAlbumDir(albumName) {
  const albumDir = path.join(OUTPUT_DIR, sanitizeFolderName(albumName));
  if (!fs.existsSync(albumDir)) {
    fs.mkdirSync(albumDir, { recursive: true });
  }
  return albumDir;
}

function getImageMetadata(imagePath) {
  try {
    const output = execSync(`exiftool -j "${imagePath}"`, { encoding: 'utf-8' });
    return JSON.parse(output)[0];
  } catch {
    return null;
  }
}

function findImageFile(photoId) {
  const files = fs.readdirSync(IMAGES_DIR);
  const pattern = new RegExp(`_${photoId}_o\\.jpg$`, 'i');
  const match = files.find(f => pattern.test(f));
  return match ? path.join(IMAGES_DIR, match) : null;
}

function convertGeoCoordinate(coord) {
  if (!coord) return null;
  return parseInt(coord, 10) / 1000000;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  return dateStr.replace(/-/g, ':');
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  return String(dateStr).split('.')[0].split('+')[0].trim();
}

function datesMatch(imageDate, jsonDate) {
  if (!imageDate || !jsonDate) return false;
  return normalizeDate(imageDate) === normalizeDate(formatDate(jsonDate));
}

function escapeExifValue(value) {
  if (!value) return '';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$');
}

function isCameraMetadata(description) {
  if (!description) return false;
  const desc = String(description).toUpperCase().trim();
  const cameraBrands = ['DIGITAL CAMERA', 'NIKON', 'CANON', 'OLYMPUS', 'SONY', 'FUJIFILM', 'PENTAX', 'PANASONIC'];
  return cameraBrands.some(brand => desc.includes(brand)) || desc.length < 5;
}

function getExistingKeywords(existingMeta) {
  return (existingMeta?.Keywords || existingMeta?.Subject || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
}

function buildExifToolCommand(destPath, jsonData, existingMeta) {
  const commands = [];
  let changesCount = 0;

  // Title
  if (jsonData.name) {
    const escapedTitle = escapeExifValue(jsonData.name);
    commands.push(`-XMP:Title="${escapedTitle}"`, `-IPTC:ObjectName="${escapedTitle}"`);
    changesCount++;
  }

  // Description (replace if camera metadata, otherwise add if missing)
  if (jsonData.description && jsonData.description.trim()) {
    const hasDesc = existingMeta?.Description || existingMeta?.['Caption-Abstract'];
    const isCameraMeta = isCameraMetadata(hasDesc);

    if (!hasDesc || isCameraMeta) {
      const escapedDesc = escapeExifValue(jsonData.description);
      commands.push(`-XMP:Description="${escapedDesc}"`, `-IPTC:Caption-Abstract="${escapedDesc}"`);
      changesCount++;
    }
  }

  // Date/Time (use JSON as source of truth)
  if (jsonData.date_taken) {
    const formattedDate = formatDate(jsonData.date_taken);
    const imageDate = existingMeta?.['DateTimeOriginal'] || existingMeta?.CreateDate;

    if (!imageDate || !datesMatch(imageDate, jsonData.date_taken)) {
      commands.push(`-DateTimeOriginal="${formattedDate}"`, `-CreateDate="${formattedDate}"`);
      changesCount++;
    }
  }

  // GPS Coordinates
  if (jsonData.geo?.[0]?.latitude) {
    const lat = convertGeoCoordinate(jsonData.geo[0].latitude);
    const lon = convertGeoCoordinate(jsonData.geo[0].longitude);
    if (lat && lon && !existingMeta?.GPSLatitude) {
      commands.push(`-GPSLatitude=${lat}`, `-GPSLongitude=${lon}`);
      changesCount++;
    }
  }

  // Keywords/Tags (merge with existing)
  if (jsonData.tags?.length > 0) {
    const existingKeywords = getExistingKeywords(existingMeta);
    const newKeywords = jsonData.tags.map(t => t.tag);
    const missingKeywords = newKeywords.filter(k => 
      !existingKeywords.some(ek => ek.toLowerCase() === k.toLowerCase())
    );

    if (missingKeywords.length > 0) {
      const allKeywords = [...existingKeywords, ...missingKeywords].join(', ');
      commands.push(`-IPTC:Keywords="${escapeExifValue(allKeywords)}"`, `-XMP:Subject="${escapeExifValue(allKeywords)}"`);
      changesCount++;
    }
  }

  // Albums
  if (jsonData.albums?.length > 0) {
    const albumNames = jsonData.albums.map(a => a.title).join('; ');
    commands.push(`-XMP:Album="${escapeExifValue(albumNames)}"`);
    changesCount++;

    // Add albums as keywords
    const existingKeywords = getExistingKeywords(existingMeta);
    const albumTitles = jsonData.albums.map(a => a.title);
    const missingAlbums = albumTitles.filter(a => 
      !existingKeywords.some(ek => ek.toLowerCase() === a.toLowerCase())
    );

    if (missingAlbums.length > 0) {
      const allKeywords = [...existingKeywords, ...missingAlbums].join(', ');
      commands.push(`-IPTC:Keywords="${escapeExifValue(allKeywords)}"`);
    }
  }

  // Flickr URL
  if (jsonData.photopage) {
    commands.push(`-XMP:Source="${escapeExifValue(jsonData.photopage)}"`);
    changesCount++;
  }

  if (commands.length === 0) {
    return { command: null, changesCount: 0 };
  }

  return {
    command: `exiftool ${commands.join(' ')} -overwrite_original "${destPath}"`,
    changesCount
  };
}

function processPhoto(jsonPath, stats) {
  try {
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const photoId = jsonData.id;

    if (!photoId) {
      stats.errors++;
      return;
    }

    const sourceImagePath = findImageFile(photoId);
    if (!sourceImagePath) {
      stats.missingImages++;
      return;
    }

    const sourceFilename = path.basename(sourceImagePath);
    
    const albumFolders = jsonData.albums?.length > 0
      ? jsonData.albums.filter(a => a.title).map(a => ensureAlbumDir(a.title))
      : [ensureAlbumDir('Uncategorized')];

    let processedAny = false;
    let totalChanges = 0;
    let failedCount = 0;

    albumFolders.forEach(albumDir => {
      const destImagePath = path.join(albumDir, sourceFilename);

      try {
        fs.copyFileSync(sourceImagePath, destImagePath);
        const existingMeta = getImageMetadata(destImagePath);
        const { command, changesCount } = buildExifToolCommand(destImagePath, jsonData, existingMeta);

        if (command) {
          execSync(command, { stdio: 'pipe' });
          totalChanges += changesCount;
        }
        processedAny = true;
      } catch (error) {
        if (fs.existsSync(destImagePath)) {
          fs.unlinkSync(destImagePath);
        }
        failedCount++;
      }
    });

    if (processedAny) {
      stats.processed++;
      stats.totalChanges += totalChanges;
    } else if (failedCount === albumFolders.length) {
      stats.errors++;
    } else {
      stats.skipped++;
    }
  } catch (error) {
    stats.errors++;
  }
}

console.log('🚀 Starting Flickr Metadata Embedding\n');
console.log('='.repeat(60));

if (!checkExifTool()) {
  console.error('❌ ExifTool is not installed or not in PATH');
  console.log('\nTo install ExifTool on macOS:');
  console.log('  brew install exiftool');
  process.exit(1);
}

ensureOutputDir();

const jsonFiles = fs.readdirSync(DATA_DIR)
  .filter(f => f.startsWith('photo_') && f.endsWith('.json'))
  .map(f => path.join(DATA_DIR, f));

console.log(`📁 Found ${jsonFiles.length} photo JSON files`);
console.log(`📁 Source images: ${IMAGES_DIR}`);
console.log(`📁 Output directory: ${OUTPUT_DIR}`);
console.log(`📁 Files will be organized by album: ${OUTPUT_DIR}/{album name}/\n`);

const stats = {
  processed: 0,
  skipped: 0,
  errors: 0,
  missingImages: 0,
  totalChanges: 0
};

const startTime = Date.now();

jsonFiles.forEach((jsonPath, index) => {
  if ((index + 1) % 100 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = ((index + 1) / elapsed).toFixed(1);
    console.log(`Progress: ${index + 1}/${jsonFiles.length} (${rate} photos/sec)...`);
  }
  processPhoto(jsonPath, stats);
});

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('\n' + '='.repeat(60));
console.log('✅ Processing complete!');
console.log(`   Processed: ${stats.processed}`);
console.log(`   Skipped: ${stats.skipped}`);
console.log(`   Errors: ${stats.errors}`);
console.log(`   Missing images: ${stats.missingImages}`);
console.log(`   Total metadata fields added/updated: ${stats.totalChanges}`);
console.log(`   Total: ${jsonFiles.length}`);
console.log(`   Time elapsed: ${elapsed}s`);
console.log(`\n📁 Enhanced images saved to: ${OUTPUT_DIR}`);
console.log(`   Images are organized by album folders (photos without albums go to "Uncategorized")`);
console.log(`   Ready for Apple Photos import with "Keep folders" option!`);