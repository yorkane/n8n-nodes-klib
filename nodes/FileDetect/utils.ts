import * as fs from 'fs';
import * as path from 'path';

/**
 * Checks if a file exists
 */
export async function checkFileExists(filePath: string): Promise<boolean> {
	try {
		await fs.promises.access(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Checks if file extension matches any of the allowed extensions
 */
export function checkFileExtension(filePath: string, allowedExtensions: string): boolean {
	const fileExt = path.extname(filePath).toLowerCase();
	const extensions = allowedExtensions
		.split(',')
		.map(ext => ext.trim().toLowerCase())
		.map(ext => ext.startsWith('.') ? ext : '.' + ext);
	return extensions.includes(fileExt);
}

/**
 * Checks if file type matches any of the expected types
 */
export async function checkFileType(filePath: string, expectedTypes: string[]): Promise<boolean> {
	try {
		const buffer = await fs.promises.readFile(filePath, { flag: 'r' });
		const fileType = detectFileType(buffer, filePath);
		return expectedTypes.includes(fileType);
	} catch {
		return false;
	}
}

/**
 * Detects file type based on buffer content and file path
 */
export function detectFileType(buffer: Buffer, filePath?: string): string {
	if (buffer.length === 0) return 'binary';

	// Check for common file signatures
	const header = buffer.subarray(0, 30);
	const fileHeader = buffer.toString('ascii', 0, 4);
	const webpHeader = buffer.toString('ascii', 8, 12);

	// Check for WebM video signature
	if (buffer.toString('ascii', 0, 4) === 'webm') {
		return 'video';
	}

	if (fileHeader === 'RIFF' && webpHeader === 'WEBP') {
		// Look for the 'ANIM' chunk to identify an animated WebP
		if (buffer.toString('ascii', 12, 40).includes('ANIM')) {
			return 'video';
		}
		// Check for VP8 (lossy) or VP8L (lossless) for static images
		// const chunkHeader = buffer.toString('ascii', 12, 16);
		// else if (chunkHeader === 'VP8 ' || chunkHeader === 'VP8L') {
			// return 'Image (Static WebP)';
		return 'image';
	}

	// Video formats
	if (header.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x00, 0x18])) ||
		header.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x00, 0x20])) ||
		header.subarray(4, 8).equals(Buffer.from('ftyp', 'ascii'))) {
		return 'video';
	}

	// Image formats
	if (header.subarray(0, 2).equals(Buffer.from([0xFF, 0xD8])) || // JPEG
		header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) || // PNG
		header.subarray(0, 6).equals(Buffer.from('GIF87a', 'ascii')) ||
		header.subarray(0, 6).equals(Buffer.from('GIF89a', 'ascii')) || // GIF
		header.subarray(0, 2).equals(Buffer.from('BM', 'ascii'))) { // BMP
		return 'image';
	}

	// Try to parse as JSON
	try {
		const text = buffer.toString('utf8');
		JSON.parse(text.trim());
		return 'json';
	} catch {
		// Not JSON, continue checking
	}

	// Check for XML format
	if (buffer.toString('utf8', 0, 100).trim().match(/^\s*<\?xml/) ||
		buffer.toString('utf8', 0, 100).trim().match(/^\s*<!DOCTYPE\s+html/) ||
		buffer.toString('utf8', 0, 100).trim().match(/^\s*<html/i)) {
		return 'text';
	}

	// Check if file has a known text extension
	if (filePath && hasTextFileExtension(filePath)) {
		return 'text';
	}

	// Check if it's text (printable ASCII + common Unicode)
	const isText = isTextFile(buffer);
	if (isText) {
		return 'text';
	}

	return 'binary';
}

/**
 * Determines if a buffer contains text content
 */
export function isTextFile(buffer: Buffer): boolean {
	// Check file extension first if available
	const sample = buffer.subarray(0, Math.min(1024, buffer.length));
	let textBytes = 0;

	for (let i = 0; i < sample.length; i++) {
		const byte = sample[i];
		// Printable ASCII, tabs, newlines, carriage returns
		if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
			textBytes++;
		} else if (byte >= 128) {
			// Potential UTF-8 character
			textBytes++;
		}
	}

	// Consider it text if more than 95% of bytes are text-like
	return (textBytes / sample.length) > 0.95;
}

/**
 * Checks if file has a common text file extension
 */
export function hasTextFileExtension(filePath: string): boolean {
	const textExtensions = [
		'.txt', '.log', '.xml', '.html', '.htm', '.csv', '.yml', '.yaml',
		'.json', '.js', '.ts', '.jsx', '.tsx', '.md', '.css', '.scss',
		'.ini', '.conf', '.config', '.sh', '.bat', '.ps1', '.py', '.java',
		'.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb', '.pl', '.sql'
	];
	const ext = path.extname(filePath).toLowerCase();
	return textExtensions.includes(ext);
}


export async function isAnimatedWebP(path: string) {
	const buf = Buffer.alloc(21);
	const fd = fs.openSync(path, 'r');
	fs.readSync(fd, buf, 0, 21, 0);
	fs.closeSync(fd);
	return (
		buf.toString('ascii', 0, 4) === 'RIFF' &&
		buf.toString('ascii', 8, 12) === 'WEBP' &&
		buf.toString('ascii', 12, 16) === 'VP8X' &&
		(buf[20] & 2) === 2
	);
}

/**
 * Checks if text file contains specified content
 */
export async function checkTextContent(filePath: string, searchText: string, useRegex: boolean): Promise<boolean> {
	try {
		// First check if it's a text file
		const buffer = await fs.promises.readFile(filePath, { flag: 'r' });
		if (!isTextFile(buffer)) {
			return false;
		}

		const content = buffer.toString('utf8');

		if (useRegex) {
			const regex = new RegExp(searchText, 'i');
			return regex.test(content);
		} else {
			return content.toLowerCase().includes(searchText.toLowerCase());
		}
	} catch {
		return false;
	}
}

/**
 * Checks if file has required permissions
 */
export async function checkPermissions(filePath: string, requiredPermissions: string[]): Promise<boolean> {
	try {
		const results: boolean[] = [];

		for (const permission of requiredPermissions) {
			if (permission === 'read') {
				try {
					await fs.promises.access(filePath, fs.constants.R_OK);
					results.push(true);
				} catch {
					results.push(false);
				}
			} else if (permission === 'write') {
				try {
					await fs.promises.access(filePath, fs.constants.W_OK);
					results.push(true);
				} catch {
					results.push(false);
				}
			} else if (permission === 'execute') {
				try {
					await fs.promises.access(filePath, fs.constants.X_OK);
					results.push(true);
				} catch {
					results.push(false);
				}
			}
		}

		return results.every(result => result);
	} catch {
		return false;
	}
}