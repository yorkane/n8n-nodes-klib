import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import { IDataObject } from 'n8n-workflow';

interface ReadFileOptions {
	filePath: string;
	outputFormat?: 'auto' | 'base64' | 'binary';
}

export async function readFile(options: ReadFileOptions): Promise<IDataObject> {
	const { filePath, outputFormat = 'auto' } = options;

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
		
		// 获取文件名
		const name = path.basename(filePath);
		
		// 获取 MIME 类型
		let mimeType = mime.lookup(filePath) || 'application/octet-stream';
		
		// 根据输出格式处理内容
		let content: string | undefined;
		let base64: string | undefined;
		
		if (outputFormat === 'binary') {
			base64 = buffer.toString('base64');
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
					base64 = buffer.toString('base64');
				}
			} else {
				base64 = buffer.toString('base64');
			}
		}

		return {
			name,
			mimeType,
			content,
			base64,
			size: stats.size,
		};
	} catch (error) {
		console.error(`读取文件 "${filePath}" 时出错:`, error);
		throw error;
	}
} 