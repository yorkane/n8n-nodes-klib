import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { checkDirectorySafety, DirectoryProtectionConfig } from './directoryProtection';
import utils from '../../../lib/utils';

const execAsync = promisify(exec);

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
	includeSubdirectories: boolean;
	deleteRootDir: boolean;
	useShell?: boolean;
	fileExtensions?: string[];
	protectionConfig?: DirectoryProtectionConfig;
	stageTest?: boolean;
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
	const { dirPath, pattern, recursive, includeFiles, includeSubdirectories, deleteRootDir, useShell, fileExtensions, protectionConfig, stageTest } = options;
	const deleted: string[] = [];

	checkDirectorySafety(dirPath, protectionConfig);
	// 如果启用了删除根目录选项，直接删除入口目录
	if (deleteRootDir) {
		if (!stageTest) {
			await fs.promises.rmdir(dirPath, { recursive: true });
		}
		deleted.push(dirPath);
		return { deleted };
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
				command = `find "${dirPath}" ${maxDepth} -type f \\( ${namePattern} \\) ${stageTest ? '-print' : '-exec rm -f {} \\;'}`;
			} else if (pattern) {
				// 使用pattern匹配文件或目录
				const maxDepth = recursive ? '' : '-maxdepth 1';
				const typeOption = includeFiles && includeSubdirectories ? '' : 
					includeFiles ? '-type f' : 
					includeSubdirectories ? '-type d' : '';
				
				// 将 Node.js 正则表达式转换为 shell 兼容的格式
				const shellPattern = utils.convertToShellRegex(pattern);

				command = `find "${dirPath}" ${maxDepth} ${typeOption} -regex "${shellPattern}" ${stageTest ? '-print' : '-exec rm -rf {} \\;'}`;
			} else if (fs.statSync(dirPath).isFile()) {
				// 删除单个文件
				command = stageTest ? `echo "${dirPath}"` : `rm -f "${dirPath}"`;
			} else {
				// 删除目录下的内容
				if (recursive && includeSubdirectories) {
					// 使用 rm -rf 删除目录下的所有内容（文件和子目录）
					// 使用 find -mindepth 1 在 stageTest 模式下列出将要删除的内容
					command = stageTest ? `find "${dirPath}" -mindepth 1 -print` : `rm -rf "${dirPath}"/*`;
				} else {
					// 只删除目录下一级的文件
					command = stageTest ? `find "${dirPath}" -maxdepth 1 -type f -print` : `rm -f "${dirPath}"/*`;
				}
			}
			
			const { stdout } = await execAsync(command);
			if (stageTest) {
				deleted.push(...stdout.split('\n').filter(Boolean));
			} else {
				deleted.push(dirPath);
			}
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
			if (!stageTest) {
				await fs.promises.unlink(dirPath);
			}
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
				if (includeSubdirectories && (!regex || regex.test(entry.name))) {
					if (!stageTest) {
						await fs.promises.rmdir(fullPath, { recursive: true });
					}
					deleted.push(fullPath);
				}
			} else if (entry.isFile() && includeFiles && (!regex || regex.test(entry.name))) {
				if (!stageTest) {
					await fs.promises.unlink(fullPath);
				}
				deleted.push(fullPath);
			}
		}
	}

	await processDirectory(dirPath);
	
	return { deleted };
} 