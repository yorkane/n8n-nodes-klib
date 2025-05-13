import * as fs from 'fs';
import * as path from 'path';
import { IExecuteFunctions, INodeExecutionData, IBinaryData } from 'n8n-workflow';
import { checkDirectorySafety } from '../../FsOperate/openrations/directoryProtection';

interface WriteFileOptions {
	filePath: string;
	content: string | Buffer | IBinaryData;
	encoding?: BufferEncoding;
	append?: boolean;
	createDirectory?: boolean;
	context: IExecuteFunctions;
	itemIndex: number;
}

export async function writeFile(options: WriteFileOptions): Promise<INodeExecutionData> {
	const { 
		filePath, 
		content, 
		encoding = 'utf8', 
		append = false, 
		createDirectory = false,
		context,
		itemIndex 
	} = options;

	try {
		// 检查目录安全性
		checkDirectorySafety(filePath);

		// 确保目录存在
		if (createDirectory) {
			const dirPath = path.dirname(filePath);
			if (!fs.existsSync(dirPath)) {
				fs.mkdirSync(dirPath, { recursive: true });
			}
		}

		// 检查父目录是否存在
		const dirPath = path.dirname(filePath);
		if (!fs.existsSync(dirPath)) {
			throw new Error(`目录不存在: ${dirPath}`);
		}

		// 准备写入内容
		let writeContent: Buffer;
		if (Buffer.isBuffer(content)) {
			writeContent = content;
		} else if (typeof content === 'string') {
			writeContent = Buffer.from(content, encoding);
		} else if (content && typeof content === 'object' && 'data' in content) {
			// 处理 BinaryData 类型
			const binaryData = await context.helpers.getBinaryDataBuffer(itemIndex, content.data);
			writeContent = binaryData;
		} else {
			throw new Error('不支持的内容类型');
		}

		// 写入文件
		if (append && fs.existsSync(filePath)) {
			fs.appendFileSync(filePath, writeContent);
		} else {
			fs.writeFileSync(filePath, writeContent);
		}

		// 获取文件状态
		const stats = fs.statSync(filePath);

		// 返回结果
		return {
			json: {
				filePath,
				fileName: path.basename(filePath),
				size: stats.size,
				created: stats.birthtime,
				modified: stats.mtime,
				status: 'success'
			}
		};
	} catch (error) {
		console.error(`写入文件 "${filePath}" 时出错:`, error);
		throw error;
	}
} 