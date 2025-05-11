import * as fs from 'fs';
import * as path from 'path';
import { checkDirectorySafety, DirectoryProtectionConfig } from './directoryProtection';

/**
 * 清理空目录
 * @param dirPath 要清理的目录路径
 * @param recursive 是否递归清理子目录
 * @param protectionConfig 目录保护配置
 * @returns Promise<void>
 */
export async function cleanEmptyDirectories(
	dirPath: string, 
	recursive: boolean = true,
	protectionConfig?: DirectoryProtectionConfig
): Promise<void> {
	// 检查目录安全性
	checkDirectorySafety(dirPath, protectionConfig);

	if (!dirPath) {
		throw new Error('Directory path cannot be empty');
	}

	// 检查目录是否存在
	try {
		const stats = await fs.promises.stat(dirPath);
		if (!stats.isDirectory()) {
			throw new Error(`Path ${dirPath} is not a directory`);
		}
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Cannot access directory ${dirPath}: ${errorMessage}`);
	}

	const files = await fs.promises.readdir(dirPath);
	
	for (const file of files) {
		const fullPath = path.join(dirPath, file);
		const stats = await fs.promises.stat(fullPath);
		
		if (stats.isDirectory()) {
			if (recursive) {
				await cleanEmptyDirectories(fullPath, true, protectionConfig);
			}
			
			const remainingFiles = await fs.promises.readdir(fullPath);
			if (remainingFiles.length === 0) {
				await fs.promises.rmdir(fullPath);
			}
		}
	}
} 