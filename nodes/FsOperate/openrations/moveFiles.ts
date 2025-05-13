import * as fs from 'fs';
import * as path from 'path';
import { checkDirectorySafety, DirectoryProtectionConfig } from './directoryProtection';

export interface MoveFilesOptions {
	sourcePath: string;
	targetDir: string;
	pattern?: string;
	recursive: boolean;
	includeFiles: boolean;
	includeSubdirectories: boolean;
	renameOnly?: boolean;
	protectionConfig?: DirectoryProtectionConfig;
	stageTest?: boolean;
}

// 将 processDirectory 函数移到外部
async function processDirectory(
	currentPath: string,
	sourcePath: string,
	targetDir: string,
	regex: RegExp,
	recursive: boolean,
	includeFiles: boolean,
	stageTest: boolean,
	moved: string[]
): Promise<void> {
	const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(currentPath, entry.name);
		const relativePath = path.relative(sourcePath, fullPath);
		const targetPath = path.join(targetDir, relativePath);
		
		if (entry.isDirectory()) {
			if (recursive) {
				await processDirectory(fullPath, sourcePath, targetDir, regex, recursive, includeFiles, stageTest, moved);
			}
			if (regex.test(entry.name)) {
				if (!stageTest) {
					await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
					await fs.promises.rename(fullPath, targetPath);
				}
				moved.push(fullPath);
			}
		} else if (entry.isFile() && includeFiles && regex.test(entry.name)) {
			if (!stageTest) {
				await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
				await fs.promises.rename(fullPath, targetPath);
			}
			moved.push(fullPath);
		}
	}
}

export async function moveFiles(options: MoveFilesOptions): Promise<{ moved: string[] }> {
	const { 
		sourcePath, 
		targetDir, 
		pattern, 
		recursive, 
		includeFiles, 
		renameOnly = false,
		protectionConfig,
		stageTest = false,
	} = options;

	// 检查源目录和目标目录的安全性
	checkDirectorySafety(sourcePath, protectionConfig);
	checkDirectorySafety(targetDir, protectionConfig);

	const moved: string[] = [];
	const regex = new RegExp(pattern);

	// 确保目标目录存在
	if (!stageTest) {
		await fs.promises.mkdir(targetDir, { recursive: true });
	}

	// 检查源路径是文件还是目录
	const stats = await fs.promises.stat(sourcePath);
	
	if (stats.isFile()) {
		if (renameOnly) {
			// 如果只需要重命名，直接重命名文件
			const targetPath = path.join(targetDir, path.basename(sourcePath));
			if (!stageTest) {
				await fs.promises.rename(sourcePath, targetPath);
			}
			moved.push(sourcePath);
		} else if (includeFiles && regex.test(path.basename(sourcePath))) {
			// 原有的文件移动逻辑
			const targetPath = path.join(targetDir, path.basename(sourcePath));
			if (!stageTest) {
				await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
				await fs.promises.rename(sourcePath, targetPath);
			}
			moved.push(sourcePath);
		}
	} else if (stats.isDirectory()) {
		if (renameOnly) {
			// 如果只需要重命名，直接重命名目录
			const targetPath = path.join(targetDir, path.basename(sourcePath));
			if (!stageTest) {
				await fs.promises.rename(sourcePath, targetPath);
			}
			moved.push(sourcePath);
		} else {
			// 使用外部定义的 processDirectory 函数
			await processDirectory(sourcePath, sourcePath, targetDir, regex, recursive, includeFiles, stageTest, moved);
		}
	}

	return { moved };
} 