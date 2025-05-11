import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import * as crypto from 'crypto';
// import { xxh64 } from '@node-rs/xxhash';
import { IDataObject, IExecuteFunctions, INodeExecutionData, IBinaryKeyData } from 'n8n-workflow';

interface ReadFileOptions {
	filePath: string;
	outputFormat?: 'auto' | 'base64' | 'binary' | 'string';
	digestAlgorithm?: 'none' | 'md5' | 'sha1' | 'sha256' | 'sha512' | 'xxhash64';
	salt?: string;
	context: IExecuteFunctions;
	itemIndex: number;
	onlyOutputDigest?: boolean;
}

export async function readFile(options: ReadFileOptions): Promise<INodeExecutionData> {
	const { filePath, outputFormat = 'auto', digestAlgorithm = 'none', salt, context, itemIndex } = options;

	try {
		// 检查文件是否存在
		if (!fs.existsSync(filePath)) {
			throw new Error(`文件不存在: ${filePath}`);
		}

		// 获取文件状态
		const stats = fs.statSync(filePath);
		if (!stats.isFile()) {
			throw new Error(`路径不是一个文件: ${filePath}`);
		}

		// 读取文件内容
		const buffer = fs.readFileSync(filePath);
		
		// 计算文件摘要
		let digest: string | undefined;
		if (digestAlgorithm === 'xxhash64') {
			// digest = xxh64(buffer).toString(16);
			digest = "xxhash64";
		} else {
			const hash = crypto.createHash(digestAlgorithm);
			if (salt) {
				hash.update(salt);
			}
			hash.update(buffer);
			digest = hash.digest('hex');
		}

		// 如果只输出摘要，则直接返回摘要
		if (options.onlyOutputDigest) {
			return {
				json: {
					filePath,
					fileName: path.basename(filePath),
					size: stats.size,
					digest: {
						algorithm: digestAlgorithm,
						value: digest
					}
				}
			};
		}
	
		// 获取 MIME 类型
		let mimeType = mime.lookup(filePath) || 'application/octet-stream';
		
		// 根据输出格式处理内容
		let content: string | undefined;
		let base64: string | undefined;
		let binary: IBinaryKeyData | undefined;
		
		if (outputFormat === 'string') {
			content = buffer.toString('utf8');
		} else if (outputFormat === 'binary') {
			const binaryData = await context.helpers.prepareBinaryData(buffer, path.basename(filePath), mimeType);
			binary = {
				data: binaryData
			};
		} else if (outputFormat === 'base64') {
			base64 = buffer.toString('base64');
		} else {
			// 自动检测模式
			const isText = () => {
				// 检查前1024字节中的null字节比例
				const sample = buffer.slice(0, Math.min(1024, buffer.length));
				const nullCount = sample.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0);
				return nullCount / sample.length < 0.1; // 如果null字节比例小于10%，认为是文本文件
			};

			if (
				mimeType.startsWith('text/') || 
				['.txt', '.json', '.xml', '.csv', '.md', '.js', '.ts', '.html', '.css'].includes(path.extname(filePath)) ||
				isText()
			) {
				try {
					content = buffer.toString('utf8');
					mimeType = mimeType.startsWith('application/') ? 'text/plain' : mimeType;
				} catch (error) {
					// 如果转换失败，回退到二进制处理
					const binaryData = await context.helpers.prepareBinaryData(buffer, path.basename(filePath), mimeType);
					binary = {
						data: binaryData
					};
				}
			} else {
				const binaryData = await context.helpers.prepareBinaryData(buffer, path.basename(filePath), mimeType);
				binary = {
					data: binaryData
				};
			}
		}

		// 构建返回数据
		const jsonData: IDataObject = {
			filePath,
			fileName: path.basename(filePath),
			mimeType,
			size: stats.size,
		};

		if (digest) {
			jsonData.digest = {
				algorithm: digestAlgorithm,
				value: digest
			};
		}

		if (content) {
			jsonData.content = content;
		}
		if (base64) {
			jsonData.base64 = base64;
		}

		const result: INodeExecutionData = {
			json: jsonData,
		};

		if (binary) {
			result.binary = binary;
		}

		return result;
	} catch (error) {
		console.error(`读取文件 "${filePath}" 时出错:`, error);
		throw error;
	}
} 