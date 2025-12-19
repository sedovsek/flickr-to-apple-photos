# Transfer Flickr pics to Apple's Photos app

Embed Flickr metadata (titles, descriptions, tags, albums, GPS) into photos to be imported into Apple's Photos.

## Step 1: Request your data from Flickr

Go to your Flickr account ([flickr.com/account](https://www.flickr.com/account)) and click on the "Request my Flickr data".

![Flickr account page showing request data button](screenshots/flickr - request my data.png)

After a few minutes, you'll receive an email that your data is available for download:

![Email notification that data is ready](screenshots/flickr - your data.png)

You'll get several zip files. One for your photos' metadata (account data), and zip files with your photos. In my example, there were 4 zip files containing photos, but the number might be different for your account.

## Step 2: Organize your files

Create two folders:
- `data`
- `images`

Unzip account data and copy its contents into the `data` folder. These files hold your basic account information, which groups you're part of, your flickr emails, etc., as well as metadata for each photo you shared (named `photo_{id}.json`).

Unzip all other files (`data-download-1.zip`, … `data-download-N.zip`) and move its files into the `images` folder. You'll notice that your pics have the following naming convention: `{title}_{id}_o.jpg`

As an example, for my photo `images/sunset_123456_o.jpg`, there's a corresponding metadata stored in `data/photo_123456.json`

If you open that JSON file in a text editor, you'll notice lots of structured information about your photo, including its name, description, which albums does it belong to, how many views it had, etc.

## Step 3: Prerequisites

1. Install Node.js: `brew install node` (or download from [nodejs.org](https://nodejs.org/))
2. Install ExifTool: `brew install exiftool`

## Step 4: Run the script

Run `node add-metadata.js` to embed metadata into images. Enhanced images will be saved to `flickr/` folder.

## Step 5: Import to Apple Photos

Open Apple Photos, then click "File" => "Import" and select the `flickr/` folder.
If you want Apple Photos to create albums, tick on the "Keep folders" option on the right-hand side.

**Note**: Albums structure will appear as
```
flickr
  Folder name (e.g. Portraits)
    Album name (e.g. Portraits)
```

Feel free to drag the innermost "Album name" albums to reorganize them or move them to the top level if you prefer a flatter structure.
