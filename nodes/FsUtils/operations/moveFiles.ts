import * as fs from 'fs';
import * as path from 'path';

interface MoveFilesOptions {
	sourcePath: string;
	targetDir: string;
	pattern: string;
	recursive: boolean;
	includeFiles: boolean;
	includeDirectories: boolean;
}

export async function moveFiles(options: MoveFilesOptions): Promise<{ moved: string[] }> {
	const { sourcePath, targetDir, pattern, recursive, includeFiles, includeDirectories } = options;
	const moved: string[] = [];
	const regex = new RegExp(pattern);

	// 确保目标目录存在
	await fs.promises.mkdir(targetDir, { recursive: true });

	// 检查源路径是文件还是目录
	const stats = await fs.promises.stat(sourcePath);
	
	if (stats.isFile()) {
		// 如果是文件，直接移动
		if (includeFiles && regex.test(path.basename(sourcePath))) {
			const targetPath = path.join(targetDir, path.basename(sourcePath));
			await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
			await fs.promises.rename(sourcePath, targetPath);
			moved.push(sourcePath);
		}
	} else if (stats.isDirectory()) {
		// 如果是目录，使用原有的目录处理逻辑
		async function processDirectory(currentPath: string) {
			const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(currentPath, entry.name);
				const relativePath = path.relative(sourcePath, fullPath);
				const targetPath = path.join(targetDir, relativePath);
				
				if (entry.isDirectory()) {
					if (recursive) {
						await processDirectory(fullPath);
					}
					if (includeDirectories && regex.test(entry.name)) {
						await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
						await fs.promises.rename(fullPath, targetPath);
						moved.push(fullPath);
					}
				} else if (entry.isFile() && includeFiles && regex.test(entry.name)) {
					await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
					await fs.promises.rename(fullPath, targetPath);
					moved.push(fullPath);
				}
			}
		}

		await processDirectory(sourcePath);
	}

	return { moved };
} 