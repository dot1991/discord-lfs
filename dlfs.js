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
		var mode = 1;
		break;
	case "download":
		if (!input) { console.error(`download what bruh`); process.exit(1); }
		if (isNaN(input)) { console.error(`input is not a number`); process.exit(1); }
		var mode = 2;
		break;
	case "delete":
		if (!input) { console.error(`bruh`); process.exit(1); }
		if (isNaN(input)) { console.error(`input is not a number`); process.exit(1); }
		var mode = 3;
		break;
	case undefined:
		console.log(
			`Discord Large-File-Storing Utility Thing v1\n` +
			`To upload a file: ${process.argv.slice(0,2).join(' ')} upload <path>\n` +
			`To download a file: ${process.argv.slice(0,2).join(' ')} download <code>`
		);
		process.exit();
		break;
	default:
		console.log("bruh");
		process.exit(1);
}
require("dotenv").config();
if (!process.env.TOKEN) { console.error(`TOKEN environment variable not set. Set it with a valid bot token or paste it in the .env file.`);  }

const DATA_GUILD_NAME = "datastore";
const DATA_CHANNEL_NAME = "data";
const META_CHANNEL_NAME = "meta";
const CHUNK_SIZE = 8e6;

var Discord = require("discord.js");
var fetch = require("node-fetch");
var fs = require("fs");
var path = require("path");
var zlib = require("zlib");

var client = new Discord.Client({restRequestTimeout: 6e4});
console.log("Logging in to Discord…");
client.login(process.env.TOKEN).catch(error => {
	console.error(`Login failed: ${error.message}\nMake sure to set the TOKEN environment variable to a valid bot token.`);
	process.exit(1);
});
client.once("ready", async () => {
	console.log(`Logged in as ${client.user.tag}`);
	//console.debug("Guilds:", client.guilds.cache.map(g => g.name));
	if (mode === 1) await uploadFile(input); else
	if (mode === 2) await downloadFile(input); else
	if (mode === 3) await deleteFile(input);
	else console.error("wtf");
	client.destroy();
});

async function uploadFile(filepath) {
	var filename = path.basename(filepath);
	var dataguild = await getDataGuild(client);
	var datachannels = dataguild.channels.cache.filter(c => c.name == DATA_CHANNEL_NAME).array();
	var attachment_list = [];
	var readstream = fs.createReadStream(filepath);
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
				message = await datachannels[index].send(new Discord.MessageAttachment(choncc, `${filename}.${index}`));
				break;
			} catch(error) {
				console.error("bruh:", error.message, "retrying…");
			}
		}
		let attachment = message.attachments.first();
		attachment_list.push(`${message.channel.id},${message.id},${attachment.id},${attachment.name}`);
		index++;
	}
	console.log("All chunks uploaded; compressing attachment list…");
	attachment_list = attachment_list.join(';');
	attachment_list = zlib.gzipSync(attachment_list);
	console.log("Uploading attachment list…");
	const INDEXFILE_NAME = `${filename}.dlfs.gz`;
	try {
		let message = await dataguild.channels.cache.find(c => c.name == META_CHANNEL_NAME).send(new Discord.MessageAttachment(attachment_list, INDEXFILE_NAME));
		var code = message.id;
		console.log(`Done; save this code to download the file: ${code}`);
		return code;
	} catch(error) {
		console.error(error.message);
		fs.writeFileSync(attachment_list, path.join(path.dirname(filepath), INDEXFILE_NAME));
		console.log(`The attachment list has been saved to ${INDEXFILE_NAME} instead.`);
		return INDEXFILE_NAME;
	}
}

async function downloadFile(code) {
	var dataguild = await getDataGuild(client);
	var metachannel = dataguild.channels.cache.find(x => x.name == META_CHANNEL_NAME);
	//console.debug(`Found meta channel ${metachannel.id}`);
	console.log("Downloading index file…");
	var message = await metachannel.messages.fetch(code);
	var attachment_list = await (await fetch(message.attachments.first().url)).buffer();
	console.log("Extracting index file…");
	attachment_list = zlib.gunzipSync(attachment_list).toString();
	attachment_list = attachment_list.split(';').map(x => x.split(','));
	attachment_list.sort((a,b) => {
		let ai = Number(a[3].split('.').pop());
		let bi = Number(b[3].split('.').pop());
		return ai - bi;
	});
	var filename = attachment_list[0][3].slice(0, -2);
	while (fs.existsSync(filename)) filename += '_';
	var writestream = fs.createWriteStream(filename);
	var index = 0;
	while (true) {
		let dat = attachment_list[index];
		if (!dat) break;
		let channel_id = dat[0], attachment_id = dat[2], attachment_name = dat[3];
		let attachment_url = `https://cdn.discordapp.com/attachments/${channel_id}/${attachment_id}/${attachment_name}`;
		console.log(`Downloading chunk #${index}…`);
		let data = (await fetch(attachment_url)).body;
		data.pipe(writestream, {end: false});
		await new Promise(resolve => data.on("end", resolve));
		index++;
	}
	writestream.end();
	console.log(`Done! Downloaded file "${filename}"`);
}

async function deleteFile(code) {
	var dataguild = await getDataGuild(client);
	var metachannel = dataguild.channels.cache.find(x => x.name == META_CHANNEL_NAME);
	//console.debug(`Found meta channel ${metachannel.id}`);
	console.log("Downloading index file…");
	var message = await metachannel.messages.fetch(code);
	var attachment_list = await (await fetch(message.attachments.first().url)).buffer();
	console.log("Extracting index file…");
	attachment_list = zlib.gunzipSync(attachment_list).toString();
	attachment_list = attachment_list.split(';');
	for (let i = 0; i < attachment_list.length; i++) {
		try {
			console.log(`Deleting chunk ${i}…`);
			let dat = attachment_list[i].split(',');
			let channel_id = dat[0], message_id = dat[1];
			let channel = await dataguild.channels.resolve(channel_id);
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
}

async function getDataGuild(client) {
	//console.log("Finding data guild…");
	let dg = client.guilds.cache.find(x => x.name == DATA_GUILD_NAME && x.ownerID == client.user.id);
	if (!dg) {
		console.log("Creating new data guild…");
		dg = await client.guilds.create(DATA_GUILD_NAME, {
			channels: [{name: META_CHANNEL_NAME}].concat(Array(499).fill({name: DATA_CHANNEL_NAME}))
		});
	} else console.log("Found existing data guild");
	//console.debug(`ID: ${dg.id} Invite: ${(await dg.channels.cache.first().createInvite()).code}`);
	return dg;
}
