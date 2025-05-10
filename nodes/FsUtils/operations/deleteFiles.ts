import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { checkDirectorySafety, DirectoryProtectionConfig } from './directoryProtection';

const execAsync = promisify(exec);

// 定义受保护的系统目录
const PROTECTED_DIRS = [
	'/',
	'/bin',
	'/boot',
	'/dev',
	'/etc',
	'/lib',
	'/lib64',
	'/proc',
	'/root',
	'/run',
	'/sbin',
	'/srv',
	'/sys',
	'C:\\',
	'C:\\Windows',
	'C:\\Program Files',
	'C:\\Program Files (x86)',
	'C:\\Users',
	'C:\\System32',
];

// 常见文件后缀名列表
export const COMMON_FILE_EXTENSIONS = [
	// Document files
	{ name: '文本', value: 'txt' },
	{ name: 'Word', value: 'doc,docx' },
	{ name: 'Excel', value: 'xls,xlsx' },
	{ name: 'PDF', value: 'pdf' },
	{ name: 'Markdown', value: 'md' },
	
	// Image files
	{ name: 'JPEG', value: 'jpg,jpeg' },
	{ name: 'PNG', value: 'png' },
	{ name: 'GIF', value: 'gif' },
	{ name: 'WebP', value: 'webp' },
	
	// Audio files
	{ name: 'MP3', value: 'mp3' },
	{ name: 'WAV', value: 'wav' },
	{ name: 'FLAC', value: 'flac' },
	
	// Video files
	{ name: 'MP4', value: 'mp4' },
	{ name: 'AVI', value: 'avi' },
	{ name: 'MKV', value: 'mkv' },
	
	// Archive files
	{ name: 'ZIP', value: 'zip' },
	{ name: 'RAR', value: 'rar' },
	{ name: '7Z', value: '7z' },
	
	// Code files
	{ name: 'JS', value: 'js' },
	{ name: 'TS', value: 'ts' },
	{ name: 'Python', value: 'py' },
	{ name: 'Java', value: 'java' },
	{ name: 'HTML', value: 'html,htm' },
	{ name: 'CSS', value: 'css' },
	
	// Log and temporary files
	{ name: '日志', value: 'log' },
	{ name: '临时', value: 'tmp,temp' },
	{ name: '备份', value: 'bak,backup' },
];

interface DeleteFilesOptions {
	dirPath: string;
	pattern?: string;
	recursive: boolean;
	includeFiles: boolean;
	includeDirectories: boolean;
	deleteRootDir: boolean;
	useShell?: boolean;
	fileExtensions?: string[];
	protectionConfig?: DirectoryProtectionConfig;
}

// 检查目录深度
function checkDirectoryDepth(dirPath: string): boolean {
	const normalizedPath = path.normalize(dirPath);
	const pathParts = normalizedPath.split(path.sep).filter(part => part !== '');
	
	// 检查是否是系统根目录或其直接子目录
	if (PROTECTED_DIRS.some(protectedDir => {
		const normalizedProtectedDir = path.normalize(protectedDir);
		return normalizedPath === normalizedProtectedDir || 
			normalizedPath.startsWith(normalizedProtectedDir + path.sep);
	})) {
		return false;
	}

	// 计算目录深度
	const depth = pathParts.length;
	
	// 只允许删除4级及以上的子目录
	return depth > 3;
}

// 检查是否是受保护的系统目录
function isProtectedDirectory(dirPath: string): boolean {
	const normalizedPath = path.normalize(dirPath);
	return PROTECTED_DIRS.some(protectedDir => {
		const normalizedProtectedDir = path.normalize(protectedDir);
		return normalizedPath === normalizedProtectedDir || 
			normalizedPath.startsWith(normalizedProtectedDir + path.sep);
	});
}

// 处理文件后缀名
function processFileExtensions(extensions: string[]): string[] {
	return extensions.map(ext => {
		// 处理多个后缀名（用逗号分隔的情况）
		return ext.split(',').map(singleExt => {
			const trimmed = singleExt.trim();
			return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
		});
	}).flat();
}

export async function deleteFiles(options: DeleteFilesOptions): Promise<{ deleted: string[] }> {
	const { dirPath, pattern, recursive, includeFiles, includeDirectories, deleteRootDir, useShell, fileExtensions, protectionConfig } = options;
	const deleted: string[] = [];

	// 检查目录安全性
	checkDirectorySafety(dirPath, protectionConfig);

	// 检查目录深度
	if (!checkDirectoryDepth(dirPath)) {
		throw new Error(`禁止删除深度低于4级的目录: ${dirPath}`);
	}

	// 检查是否是受保护的系统目录
	if (isProtectedDirectory(dirPath)) {
		throw new Error(`禁止删除系统目录: ${dirPath}`);
	}

	// 如果启用shell命令删除
	if (useShell) {
		try {
			let command: string;
			
			// 如果指定了文件后缀，使用find命令
			if (fileExtensions && fileExtensions.length > 0) {
				const processedExtensions = processFileExtensions(fileExtensions);
				const maxDepth = recursive ? '' : '-maxdepth 1';
				const namePattern = processedExtensions.map(ext => `-name "*${ext}"`).join(' -o ');
				command = `find "${dirPath}" ${maxDepth} -type f \\( ${namePattern} \\) -exec rm -f {} \\;`;
			} else if (fs.statSync(dirPath).isFile()) {
				// 删除单个文件
				command = `rm -f "${dirPath}"`;
			} else {
				// 删除目录
				if (recursive) {
					command = `rm -rf "${dirPath}"`;
				} else {
					command = `rm -f "${dirPath}"/*`;
				}
			}
			
			await execAsync(command);
			deleted.push(dirPath);
			return { deleted };
		} catch (error) {
			throw new Error(`Shell命令执行失败: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	// 检查路径是文件还是目录
	try {
		const stats = await fs.promises.stat(dirPath);
		
		// 如果是文件，直接删除
		if (stats.isFile()) {
			await fs.promises.unlink(dirPath);
			deleted.push(dirPath);
			return { deleted };
		}
	} catch (error) {
		throw new Error(`路径不存在或无法访问: ${error instanceof Error ? error.message : String(error)}`);
	}

	// 如果是目录，执行目录删除逻辑
	const regex = pattern ? new RegExp(pattern) : null;

	async function processDirectory(currentPath: string) {
		const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(currentPath, entry.name);
			
			if (entry.isDirectory()) {
				if (recursive) {
					await processDirectory(fullPath);
				}
				if (includeDirectories && (!regex || regex.test(entry.name))) {
					await fs.promises.rmdir(fullPath);
					deleted.push(fullPath);
				}
			} else if (entry.isFile() && includeFiles && (!regex || regex.test(entry.name))) {
				await fs.promises.unlink(fullPath);
				deleted.push(fullPath);
			}
		}
	}

	await processDirectory(dirPath);
	
	// 如果启用了删除根目录选项，则在处理完所有内容后删除根目录
	if (deleteRootDir) {
		await fs.promises.rmdir(dirPath);
		deleted.push(dirPath);
	}
	
	return { deleted };
} 