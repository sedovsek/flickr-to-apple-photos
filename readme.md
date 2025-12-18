# Transfer Flickr pics to Apple's Photos app

Embed Flickr metadata (titles, descriptions, tags, albums, GPS) into photos to be imported into Apple's Photos.

## Setup

1. Install Node.js: `brew install node` (or download from [nodejs.org](https://nodejs.org/))
2. Install ExifTool: `brew install exiftool`
3. Organize files:
   - Extract metadata JSON files to `data/` folder
   - Extract photos to `images/` folder

## Usage

Run `node add-metadata.js` to embed metadata into images. Enhanced images will be saved to `images-with-metadata/` folder.

## Import to Apple Photos

Drag and drop the `images-with-metadata/` folder into Apple Photos.

**Note:** Albums need to be created manually or programmatically - they won't be created automatically from metadata.