# Discord LFS
A utility that uploads a file as large as you want, to Discord. It works by splitting the file into 8MB chunks and uploading them as attachments to separate channels on a guild so it's not affected by rate limits. The information of each attachment is collected and saved to a compressed file which anyone can use with this program to download the original file.

### Warning
THIS IS API ABUSE! You may get in trouble if you upload ridiculously large amounts of data.

## Setup
Node.js 12.9 or newer is required.
```sh
wget https://github.com/ledlamp/discord-lfs/archive/master.zip -O discord-lfs.zip
unzip discord-lfs.zip
cd discord-lfs
npm ci
chmod a+x dlfs.js
```
Unless you only need to download, create a Discord bot and copy its token. Create a file named `.env`, type `TOKEN=` and paste the token after it.

## Usage
Open terminal in the folder.
```
./dlfs.js upload <path-to-file>
```
When this is finished a .dlfs.gz file will be saved in the working directory. Anyone can use that metadata file with this program to download the original file.
```
./dlfs.js download <path or http url of .dlfs.gz file>
```
This will download the original file, represented by the metadata (.dlfs.gz) file, into the working directory. This does not require a bot token.

If you want to delete the file from Discord's servers:
```
./dlfs.js delete <path or http url of .dlfs.gz file>
```

(On Windows you may have to use `node dlfs.js` instead of `./dlfs.js`.)
