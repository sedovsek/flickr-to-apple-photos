# Transfer Flickr pics to Apple's Photos app

Embed Flickr metadata (titles, descriptions, tags, albums, GPS) into photos to be imported into Apple's Photos.

## Setup (pre-requirements)

1. Install Node.js: `brew install node` (or download from [nodejs.org](https://nodejs.org/))
2. Install ExifTool: `brew install exiftool`
3. Organize files:
   - Extract metadata JSON files to `data/` folder
   - Extract photos to `images/` folder

## Usage

Run `node add-metadata.js` to embed metadata into images. Enhanced images will be saved to `flickr/` folder.

## Import to Apple Photos

Open Apple Photos, then click "File" => "Import" and select the `flickr/`.
If you want Apple Photos to create albums, tick on the "Keep folders" option on the right-hand side.

**Note**: Albums structure will appear as
```
flickr
  Folder name (e.g. Portraits)
    Album name (e.g. Portraits)
```

Feel free to drag the innermost "Album name" albums to reorganize them or move them to the top level if you prefer a flatter structure.