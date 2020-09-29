# Discord LFS
A utility that uploads a file as large as you want, to Discord. It works by splitting the file into 8MB chunks and uploading them as attachments to separate channels on a guild so it's not affected by rate limits. The information of each attachment is collected and uploaded as a compressed file into one meta channel so you just keep that message id.

### Warning
THIS IS API ABUSE! You may get in trouble if you upload ridiculously large amounts of data.

## Setup
Node.js 12 or newer is required.
```sh
wget https://github.com/ledlamp/discord-lfs/archive/master.zip -O discord-lfs.zip
unzip discord-lfs.zip
cd discord-lfs
npm ci
```
Create a Discord bot and copy its token. Create a file named `.env`, type `TOKEN=` and paste the token after it.

## Usage
Open terminal in the folder.
```
./dlfs.js upload <path-to-file>
```
You will receive a code when it's finished. You will need to use this code with the same bot account to download the file.
```
./dlfs.js download <code>
```
This will download to the working directory, appending _ if the destination file already exists.

If you want to delete the file from Discord's servers:
```
./dlfs.js delete <code>
```
