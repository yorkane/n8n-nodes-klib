import * as fs from 'fs';
import * as path from 'path';

/**
 * 清理空目录
 * @param dirPath 要清理的目录路径
 * @param recursive 是否递归清理子目录
 * @returns Promise<void>
 */
export async function cleanEmptyDirectories(dirPath: string, recursive: boolean = false): Promise<void> {
	if (!dirPath) {
		throw new Error('目录路径不能为空');
	}

	// 检查目录是否存在
	try {
		const stats = await fs.promises.stat(dirPath);
		if (!stats.isDirectory()) {
			throw new Error(`路径 ${dirPath} 不是一个目录`);
		}
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`无法访问目录 ${dirPath}: ${errorMessage}`);
	}

	const files = await fs.promises.readdir(dirPath);
	
	for (const file of files) {
		const fullPath = path.join(dirPath, file);
		const stats = await fs.promises.stat(fullPath);
		
		if (stats.isDirectory()) {
			if (recursive) {
				await cleanEmptyDirectories(fullPath, true);
			}
			
			const remainingFiles = await fs.promises.readdir(fullPath);
			if (remainingFiles.length === 0) {
				await fs.promises.rmdir(fullPath);
			}
		}
	}
} 