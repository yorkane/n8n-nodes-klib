import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import * as fs from 'fs';
import * as path from 'path';

function response(success = false, infohash = "", magnet_uri = "", dn = "", xl = 0, main_tracker = "", tracker_list = [], is_private = false, files = []) {
	return { success, infohash, magnet_uri, dn, xl, main_tracker, tracker_list, is_private, files };
}

function torrent2magnet(buffer_content: Uint8Array) {
	if (!buffer_content || buffer_content instanceof Uint8Array === false) {
		console.error("input is not a Uint8Array");
		return response();
	}

	// decode torrent file
	const torrent = decodeTorrent(buffer_content);

	if (!torrent.info) {
		console.error("invalid torrent file");
		return response();
	}

	// exact topic (xt) is a URN containing the content hash of the torrent file
	const infohash = sha1(encodeTorrent(torrent.info)).toUpperCase();

	const decoder = new TextDecoder("utf-8");

	// name of torrent file (dn)
	const dn = torrent.info.name ? decoder.decode(torrent.info.name) : "";

	// length of torrent file (xl)
	const xl = torrent.info.length || 0;

	// main tracker (tr)
	const main_tracker = torrent.announce ? decoder.decode(torrent.announce) : "";

	// url of trackers (tr)
	let tracker_list = [];
	const announce_list = torrent["announce-list"];
	if (announce_list) {
		for (let i = 0; i < announce_list.length; i++) {
			const tracker = announce_list[i];
			tracker_list.push(decoder.decode(tracker[0]));
		}
	}
	const tr = tracker_list.join("&tr=") || "";

	// if torrent has multiple files, info contains files with their length and path
	const files = [];
	if (torrent.info.files && torrent.info.files.length > 0) {
		for (let i = 0; i < torrent.info.files.length; i++) {
			let path = "";
			// if the torrent file has folders inside, the path is an array of strings, so we need to join the paths with "/"
			for (let j = 0; j < torrent.info.files[i].path.length; j++) {
				path += `${j > 0 ? "/" : ""}` + decoder.decode(torrent.info.files[i].path[j]);
			}
			const length = torrent.info.files[i].length || 0;
			files.push({ path, length });
		}
	}

	// magnet uri, so far we have: xt, dn, xl, tr
	const magnet_uri = `magnet:?xt=urn:btih:${infohash}${dn ? `&dn=${dn}` : ""}${`&xl=${xl}`}${tr ? `&tr=${tr}` : ""}`;

	// is torrent private (private), 1 = true, 0 = false. If private, only the main tracker can be used
	const is_private = torrent.info.private === 1 ? true : false;

	return response(true, infohash, magnet_uri, dn, xl, main_tracker, tracker_list, is_private, files);
}

// Simple bencode implementation
function decodeTorrent(buffer: Uint8Array): any {
	const decoder = new TextDecoder("utf-8");
	let pos = 0;

	function decode(): any {
		const char = String.fromCharCode(buffer[pos]);
		if (char === 'd') {
			pos++;
			const dict: { [key: string]: any } = {};
			while (String.fromCharCode(buffer[pos]) !== 'e') {
				const key = decode();
				const value = decode();
				dict[key] = value;
			}
			pos++;
			return dict;
		} else if (char === 'l') {
			pos++;
			const list: any[] = [];
			while (String.fromCharCode(buffer[pos]) !== 'e') {
				list.push(decode());
			}
			pos++;
			return list;
		} else if (char === 'i') {
			pos++;
			let numStr = '';
			while (String.fromCharCode(buffer[pos]) !== 'e') {
				numStr += String.fromCharCode(buffer[pos]);
				pos++;
			}
			pos++;
			return parseInt(numStr, 10);
		} else if (/[0-9]/.test(char)) {
			let lenStr = '';
			while (/[0-9]/.test(String.fromCharCode(buffer[pos]))) {
				lenStr += String.fromCharCode(buffer[pos]);
				pos++;
			}
			const len = parseInt(lenStr, 10);
			pos++; // skip ':'
			const str = buffer.slice(pos, pos + len);
			pos += len;
			return str;
		}
		throw new Error('Invalid bencode');
	}

	return decode();
}

function encodeTorrent(obj: any): Uint8Array {
	const encoder = new TextEncoder();
	const parts: Uint8Array[] = [];

	function encode(obj: any): void {
		if (typeof obj === 'number') {
			parts.push(encoder.encode(`i${obj}e`));
		} else if (obj instanceof Uint8Array) {
			parts.push(encoder.encode(`${obj.length}:`));
			parts.push(obj);
		} else if (Array.isArray(obj)) {
			parts.push(encoder.encode('l'));
			obj.forEach(encode);
			parts.push(encoder.encode('e'));
		} else if (typeof obj === 'object') {
			parts.push(encoder.encode('d'));
			const keys = Object.keys(obj).sort();
			keys.forEach(key => {
				encode(encoder.encode(key));
				encode(obj[key]);
			});
			parts.push(encoder.encode('e'));
		}
	}

	encode(obj);
	return new Uint8Array(parts.reduce((acc, part) => acc + part.length, 0));
}

// Simple SHA1 implementation
function sha1(msg: Uint8Array): string {
	let h0 = 0x67452301;
	let h1 = 0xEFCDAB89;
	let h2 = 0x98BADCFE;
	let h3 = 0x10325476;
	let h4 = 0xC3D2E1F0;

	const msgLen = msg.length;
	const totalLen = msgLen + 9;
	const blockCount = Math.ceil(totalLen / 64);
	const padded = new Uint8Array(blockCount * 64);

	padded.set(msg);
	padded[msgLen] = 0x80;

	const msgBits = msgLen * 8;
	for (let i = 0; i < 8; i++) {
		padded[padded.length - 8 + i] = (msgBits >>> (56 - i * 8)) & 0xFF;
	}

	for (let i = 0; i < blockCount; i++) {
		const block = padded.slice(i * 64, (i + 1) * 64);
		const words = new Uint32Array(80);

		for (let j = 0; j < 16; j++) {
			words[j] = (block[j * 4] << 24) | (block[j * 4 + 1] << 16) | (block[j * 4 + 2] << 8) | block[j * 4 + 3];
		}

		for (let j = 16; j < 80; j++) {
			words[j] = ((words[j - 3] ^ words[j - 8] ^ words[j - 14] ^ words[j - 16]) << 1) | ((words[j - 3] ^ words[j - 8] ^ words[j - 14] ^ words[j - 16]) >>> 31);
		}

		let a = h0;
		let b = h1;
		let c = h2;
		let d = h3;
		let e = h4;

		for (let j = 0; j < 80; j++) {
			let f, k;
			if (j < 20) {
				f = (b & c) | ((~b) & d);
				k = 0x5A827999;
			} else if (j < 40) {
				f = b ^ c ^ d;
				k = 0x6ED9EBA1;
			} else if (j < 60) {
				f = (b & c) | (b & d) | (c & d);
				k = 0x8F1BBCDC;
			} else {
				f = b ^ c ^ d;
				k = 0xCA62C1D6;
			}

			const temp = ((a << 5) | (a >>> 27)) + f + e + k + words[j];
			e = d;
			d = c;
			c = (b << 30) | (b >>> 2);
			b = a;
			a = temp;
		}

		h0 = (h0 + a) | 0;
		h1 = (h1 + b) | 0;
		h2 = (h2 + c) | 0;
		h3 = (h3 + d) | 0;
		h4 = (h4 + e) | 0;
	}

	return [h0, h1, h2, h3, h4].map(h => h.toString(16).padStart(8, '0')).join('');
}

export class TorrentParse implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Torrent Parse',
		name: 'torrentParse',
		icon: 'file:TorrentParse.svg',
		group: ['transform'],
		version: 1,
		description: 'Parse torrent file from base64 or file path',
		defaults: {
			name: 'Torrent Parse',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Input Type',
				name: 'inputType',
				type: 'options',
				options: [
					{
						name: 'Base64',
						value: 'base64',
					},
					{
						name: 'File Path',
						value: 'filePath',
					},
				],
				default: 'base64',
				description: 'The type of input to parse',
			},
			{
				displayName: 'Base64 Content',
				name: 'base64Content',
				type: 'string',
				default: '',
				description: 'The base64 encoded torrent file content',
				displayOptions: {
					show: {
						inputType: ['base64'],
					},
				},
			},
			{
				displayName: 'File Path',
				name: 'filePath',
				type: 'string',
				default: '',
				description: 'The path to the torrent file',
				displayOptions: {
					show: {
						inputType: ['filePath'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const inputType = this.getNodeParameter('inputType', i) as string;
				let bufferContent: Uint8Array;

				if (inputType === 'base64') {
					const base64Content = this.getNodeParameter('base64Content', i) as string;
					bufferContent = Buffer.from(base64Content, 'base64');
				} else {
					const filePath = this.getNodeParameter('filePath', i) as string;
					const absolutePath = path.resolve(filePath);
					bufferContent = fs.readFileSync(absolutePath);
				}

				const result = torrent2magnet(bufferContent);
				
				returnData.push({
					json: result,
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
} 