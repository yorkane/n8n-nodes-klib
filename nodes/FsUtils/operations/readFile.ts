import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import * as crypto from 'crypto';
// import { xxh64 } from '@node-rs/xxhash';
import { IDataObject, IExecuteFunctions, INodeExecutionData, IBinaryKeyData } from 'n8n-workflow';

interface ReadFileOptions {
	filePath?: string;
	inputBinaryDataProperty?: string;
	inputBase64DataProperty?: string;
	directBase64Content?: string;
	outputFormat?: 'auto' | 'base64' | 'binary' | 'string';
	digestAlgorithm?: 'none' | 'md5' | 'sha1' | 'sha256' | 'sha512'; // | 'xxhash64';
	salt?: string;
	context: IExecuteFunctions;
	itemIndex: number;
	onlyOutputDigest?: boolean;
	binaryPropertyName?: string;
}

export async function readFile(options: ReadFileOptions): Promise<INodeExecutionData> {
	const {
		filePath,
		inputBinaryDataProperty,
		inputBase64DataProperty,
		directBase64Content,
		outputFormat = 'auto',
		digestAlgorithm = 'none',
		salt,
		context,
		itemIndex,
		onlyOutputDigest,
		binaryPropertyName = 'data',
	} = options;

	let buffer: Buffer;
	let resolvedFilePath: string | undefined = filePath;
	let fileSize: number;
	let effectiveFileName: string;
	let determinedMimeType: string;

	if (inputBinaryDataProperty) {
		const allInputData = context.getInputData();
		const inputItem = allInputData[itemIndex];

		if (!inputItem) {
			throw new Error(`Input item at index ${itemIndex} not found.`);
		}

		if (!inputItem.binary || !inputItem.binary[inputBinaryDataProperty]) {
			throw new Error(
				`Binary property "${inputBinaryDataProperty}" not found in input item ${itemIndex}.`,
			);
		}
		
		buffer = await context.helpers.getBinaryDataBuffer(itemIndex, inputBinaryDataProperty);
		fileSize = buffer.length;

		const binaryObject = inputItem.binary[inputBinaryDataProperty];

		effectiveFileName =
			binaryObject.fileName || (resolvedFilePath ? path.basename(resolvedFilePath) : 'input.bin');
		determinedMimeType =
			binaryObject.mimeType ||
			(resolvedFilePath ? mime.lookup(resolvedFilePath) || 'application/octet-stream' : 'application/octet-stream');
	} else if (inputBase64DataProperty) {
		const allInputData = context.getInputData();
		const inputItem = allInputData[itemIndex];

		if (!inputItem) {
			throw new Error(`Input item at index ${itemIndex} not found for base64 input.`);
		}

		if (!inputItem.json || typeof inputItem.json[inputBase64DataProperty] !== 'string') {
			throw new Error(
				`Property "${inputBase64DataProperty}" not found or not a string in input item ${itemIndex} JSON data.`,
			);
		}
		
		const base64String = inputItem.json[inputBase64DataProperty] as string;
		try {
			buffer = Buffer.from(base64String, 'base64');
		} catch (error: any) {
			throw new Error(
				`Failed to decode base64 string from property "${inputBase64DataProperty}" for item ${itemIndex}: ${error.message}`,
			);
		}
		fileSize = buffer.length;
		effectiveFileName = resolvedFilePath ? path.basename(resolvedFilePath) : 'base64_input.bin';
		determinedMimeType = resolvedFilePath ? (mime.lookup(resolvedFilePath) || 'application/octet-stream') : 'application/octet-stream';
	} else if (directBase64Content) {
		try {
			buffer = Buffer.from(directBase64Content, 'base64');
		} catch (error: any) {
			throw new Error(
				`Failed to decode direct base64 string: ${error.message}`,
			);
		}
		fileSize = buffer.length;
		effectiveFileName = resolvedFilePath ? path.basename(resolvedFilePath) : 'direct_base64_input.bin';
		determinedMimeType = resolvedFilePath ? (mime.lookup(resolvedFilePath) || 'application/octet-stream') : 'application/octet-stream';
	} else if (resolvedFilePath) {
		if (!fs.existsSync(resolvedFilePath)) {
			throw new Error(`文件不存在: ${resolvedFilePath}`);
		}
		const stats = fs.statSync(resolvedFilePath);
		if (!stats.isFile()) {
			throw new Error(`路径不是一个文件: ${resolvedFilePath}`);
		}
		buffer = fs.readFileSync(resolvedFilePath);
		fileSize = stats.size;
		effectiveFileName = path.basename(resolvedFilePath);
		determinedMimeType = mime.lookup(resolvedFilePath) || 'application/octet-stream';
	} else {
		throw new Error('Either "filePath", "inputBinaryDataProperty", "inputBase64DataProperty", or "directBase64Content" must be provided.');
	}

	let digest: string | undefined;
	const supportedCryptoAlgorithms = ['md5', 'sha1', 'sha256', 'sha512'];

	if (digestAlgorithm && digestAlgorithm !== 'none' && supportedCryptoAlgorithms.includes(digestAlgorithm)) {
		const hash = crypto.createHash(digestAlgorithm);
		if (salt) {
			hash.update(salt);
		}
		hash.update(buffer);
		digest = hash.digest('hex');
	}

	if (onlyOutputDigest) {
		return {
			json: {
				filePath: resolvedFilePath,
				fileName: effectiveFileName,
				size: fileSize,
				digest: {
					algorithm: digestAlgorithm,
					value: digest,
				},
			},
		};
	}

	let content: string | undefined;
	let base64Data: string | undefined;
	let binaryOutput: IBinaryKeyData | undefined;
	
	let currentMimeType = determinedMimeType;

	if (outputFormat === 'string') {
		content = buffer.toString('utf8');
	} else if (outputFormat === 'binary') {
		const binaryData = await context.helpers.prepareBinaryData(buffer, effectiveFileName, currentMimeType);
		binaryOutput = {
			[binaryPropertyName]: binaryData,
		};
	} else if (outputFormat === 'base64') {
		base64Data = buffer.toString('base64');
	} else {
		const isBufferTextual = () => {
			const sample = buffer.slice(0, Math.min(1024, buffer.length));
			const nullCount = sample.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0);
			return nullCount / sample.length < 0.1;
		};

		const fileExt = resolvedFilePath ? path.extname(resolvedFilePath).toLowerCase() : path.extname(effectiveFileName).toLowerCase();

		if (
			currentMimeType.startsWith('text/') ||
			['.txt', '.json', '.xml', '.csv', '.md', '.js', '.ts', '.html', '.css'].includes(fileExt) ||
			isBufferTextual()
		) {
			try {
				content = buffer.toString('utf8');
				if (currentMimeType.startsWith('application/')) {
					currentMimeType = 'text/plain';
				} else if ((!currentMimeType || currentMimeType === 'application/octet-stream') && content !== undefined ) {
					currentMimeType = 'text/plain';
				}
			} catch (error) {
				const binaryData = await context.helpers.prepareBinaryData(buffer, effectiveFileName, determinedMimeType);
				binaryOutput = {
					[binaryPropertyName]: binaryData,
				};
				currentMimeType = determinedMimeType;
			}
		} else {
			const binaryData = await context.helpers.prepareBinaryData(buffer, effectiveFileName, currentMimeType);
			binaryOutput = {
				[binaryPropertyName]: binaryData,
			};
		}

		if (content === undefined && !binaryOutput) {
			 const binaryData = await context.helpers.prepareBinaryData(buffer, effectiveFileName, determinedMimeType);
			 binaryOutput = { [binaryPropertyName]: binaryData	};
			 currentMimeType = determinedMimeType;
		}
	}

	const jsonData: IDataObject = {
		filePath: resolvedFilePath,
		fileName: effectiveFileName,
		mimeType: currentMimeType,
		size: fileSize,
	};

	if (digest) {
		jsonData.digest = {
			algorithm: digestAlgorithm,
			value: digest,
		};
	}

	if (content !== undefined) {
		jsonData.content = content;
	}
	if (base64Data) {
		jsonData.base64 = base64Data;
	}

	const result: INodeExecutionData = {
		json: jsonData,
	};

	if (binaryOutput) {
		result.binary = binaryOutput;
	}

	return result;
} 