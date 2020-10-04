#!/usr/bin/env node
process.on("unhandledRejection", (reason) => {
	console.error(`An error occured: ${reason}`);
	process.exit(1);
});
var argv = process.argv.slice(2);
var command = argv[0];
var input = argv.slice(1).join(' ');
switch (command) {
	case "upload":
		if (!input) { console.error(`input a file path u derp`); process.exit(1); }
		let stat = require("fs").statSync(input);
		if (!stat.isFile()) {
			if (stat.isDirectory()) console.log(`Directories are not supported; archive it with tar or something first.`);
			else console.log(`wtf is dis\ngive me regular file!`);
			process.exit(1);
		}
		uploadFile(input);
		break;
	case "download":
		if (!input) { console.error(`download what bruh`); process.exit(1); }
		downloadFile(input);
		break;
	case "delete":
		if (!input) { console.error(`bruh`); process.exit(1); }
		deleteFile(input);
		break;
	case undefined:
		console.log(
			`Discord Large-File-Storing Utility Thing\n` +
			`To upload a file: ${process.argv.slice(0,2).join(' ')} upload <path to any file>\n` +
			`To download a file: ${process.argv.slice(0,2).join(' ')} download <http url or path to .dlfs.gz file>\n` +
			`To delete a file you uploaded: ${process.argv.slice(0,2).join(' ')} <http url or path to .dlfs.gz file>`
		);
		process.exit();
		break;
	default:
		console.log("bruh");
		process.exit(1);
}

const DATA_GUILD_NAME = "datastore";
const DATA_CHANNEL_NAME = "data";
const CHUNK_SIZE = 8e6;

async function prepareClient() {
	require("dotenv").config();
	var client = new (require("discord.js")).Client({restRequestTimeout: 6e4});
	console.log("Logging in to Discord…");
	await client.login(process.env.TOKEN).catch(error => {
		console.error(`Login failed: ${error.message}\nMake sure to set the TOKEN environment variable to a valid bot token.`);
		process.exit(1);
	});
	await new Promise(r => client.on("ready", r));
	client.dataguild = client.guilds.cache.find(x => x.name == DATA_GUILD_NAME && x.ownerID == client.user.id);
	if (!client.dataguild) {
		console.log("Creating new data guild…");
		client.dataguild = await client.guilds.create(DATA_GUILD_NAME, {
			channels: [Array(500).fill({name: DATA_CHANNEL_NAME})]
		});
	} else console.log("Found data guild");
	//console.debug(`ID: ${dg.id} Invite: ${(await dg.channels.cache.first().createInvite()).code}`);
	return client;
}

async function uploadFile(filepath) {
	var readstream = require("fs").createReadStream(filepath);
	var client = await prepareClient();
	var datachannels = client.dataguild.channels.cache.filter(c => c.name == DATA_CHANNEL_NAME).array();
	var filename = require("path").basename(filepath);
	var metadata = [JSON.stringify({filename})]; // still not sure what to call this
	var index = 0;
	while (true) {
		let choncc = readstream.read(CHUNK_SIZE);
		if (!choncc) {
			if (readstream.readableEnded) break;
			else {
				await new Promise(r => setTimeout(r, 100));
				continue;
			}
		}
		console.log(`Uploading chunk #${index}…`);
		let message;
		while (true) {
			try {
				message = await datachannels[index].send(new (require("discord.js")).MessageAttachment(choncc, `${filename}.${index}`));
				break;
			} catch(error) {
				console.error("bruh:", error.message, "retrying…");
			}
		}
		let attachment = message.attachments.first();
		metadata.push(`${message.channel.id},${message.id},${attachment.id},${attachment.name}`);
		index++;
	}
	console.log("All chunks uploaded; saving metadata…");
	metadata = metadata.join(';');
	metadata = require("zlib").gzipSync(metadata);
	var metadatafilename = `${filename}.dlfs.gz`;
	while (require("fs").existsSync(metadatafilename)) metadatafilename += '_';
	require("fs").writeFileSync(metadatafilename, metadata);
	console.log(`Metadata file written to ${metadatafilename}. Anyone with this metadata file can download the original file using this program.`);
	client.destroy();
}

async function downloadFile(x) {
	var {metadata, filename} = await loadMetadata(x);
	while (require("fs").existsSync(filename)) filename += '_';
	var writestream = require("fs").createWriteStream(filename);
	var index = 0;
	while (true) {
		let dat = metadata[index];
		if (!dat) break;
		let channel_id = dat[0], attachment_id = dat[2], attachment_name = dat[3];
		let attachment_url = `https://cdn.discordapp.com/attachments/${channel_id}/${attachment_id}/${attachment_name}`;
		console.log(`Downloading chunk #${index}…`);
		let data = (await require("node-fetch")(attachment_url)).body;
		data.pipe(writestream, {end: false});
		await new Promise(resolve => data.on("end", resolve));
		index++;
	}
	writestream.end();
	console.log(`Done! Downloaded to "${filename}"`);
}

async function deleteFile(x) {
	var {metadata} = await loadMetadata(x);
	var client = await prepareClient();
	for (let i = 0; i < metadata.length; i++) {
		try {
			console.log(`Deleting chunk ${i}…`);
			let channel_id = metadata[i][0], message_id = metadata[i][1];
			let channel = await client.dataguild.channels.resolve(channel_id);
			//console.debug(`Found channel ${channel_id}`);
			let message = await channel.messages.fetch(message_id);
			//console.debug(`Found message ${message_id}`);
			await message.delete();
			//console.debug(`Deleted message ${message_id}`);
		} catch (error) {
			console.error(`${i}: ${error.message}`);
		}
	}
	console.log(`Done`);
	client.destroy();
}

async function loadMetadata(urlorpath){
	console.log("Loading metadata file…");
	if (/^https?:\/\//.test(urlorpath)) {
		var metadata = (await require("node-fetch")(urlorpath)).body;
	} else {
		var metadata = require("fs").readFileSync(urlorpath);
	}
	metadata = require("zlib").gunzipSync(metadata).toString();
	metadata = metadata.split(';');
	var metametadata = JSON.parse(metadata.shift());
	metadata = metadata.map(x => x.split(','));
	metadata.sort((a,b) => {
		let ai = Number(a[3].split('.').pop());
		let bi = Number(b[3].split('.').pop());
		return ai - bi;
	});
	return {filename: metametadata.filename, metadata}
}
