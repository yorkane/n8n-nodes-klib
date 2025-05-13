import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { IDataObject } from 'n8n-workflow';
const execAsync = promisify(exec);

/**
 * File information interface
 */
interface FileInfo extends IDataObject {
	name: string;            // File name
	path: string;            // File path
	parent: string;         // Parent directory path
	type: 'directory' | 'file'; // Type
	size: number;           // File size
	mtime: Date;           // Modified time
	depth: number;         // Current depth
	hasSubDirs?: boolean;  // Has subdirectories
}

/**
 * Find command options interface
 */
interface FindOptions {
	dirPath: string;           // Directory path
	fileExtensions?: string;   // File extensions list (comma-separated)
	showFiles?: boolean;       // Show files
	showDirectories?: boolean; // Show directories
	maxDepth?: number;         // Traversal depth
	onlyLeafDirs?: boolean;    // Show only leaf directories
	filter?: string;          // Regular expression pattern to filter files/directories by name
	sortBy?: string;          // Sort by field (name, mtime, type)
	sortDirection?: 'asc' | 'desc'; // Sort direction
	maxRecords?: number;      // Maximum number of records to return
}

/**
 * Process file extensions
 */
function processFileExtensions(extensions: string): string[] {
	if (!extensions) return [];
	return extensions.split(',')
		.map(ext => ext.trim())
		.filter(ext => ext)
		.map(ext => ext.startsWith('.') ? ext : `.${ext}`);
}

/**
 * Get file list using find command
 */
export async function findFiles(options: FindOptions): Promise<FileInfo[]> {
	const { dirPath, fileExtensions = '', maxDepth = 1, showFiles = true, showDirectories = true, filter, sortBy = 'name', sortDirection = 'asc', onlyLeafDirs = false, maxRecords = 100 } = options;
	
	// First verify directory exists
	if (!fs.existsSync(dirPath)) {
		const error = `Directory does not exist: ${dirPath}`;
		throw new Error(error);
	}

	// Build find command
	let command = `find "${dirPath}" -maxdepth ${maxDepth}`;
	
	// Build type conditions
	const typeConditions = [];
	
	// Handle files
	if (showFiles) {
		const processedExtensions = processFileExtensions(fileExtensions);
		// 保留关键扩展名日志（如需可注释掉）
		// console.log('Processed file extensions:', processedExtensions);
		if (processedExtensions.length > 0) {
			// 为每个扩展名创建一个条件，使用 -iname 进行不区分大小写的匹配
			const nameConditions = processedExtensions.map(ext => {
				// 移除开头的点号，因为 -iname 模式会自动处理
				const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
				return `-iname "*${cleanExt}"`;
			}).join(' -o ');
			
			// 将文件类型和名称条件组合
			typeConditions.push(`\\( -type f -and \\( ${nameConditions} \\) \\)`);
		} else {
			typeConditions.push('-type f');
		}
	}
	
	// Handle directories
	if (showDirectories) {
		typeConditions.push('-type d');
	}
	
	// Combine all conditions
	if (typeConditions.length > 0) {
		command += ` \\( ${typeConditions.join(' -o ')} \\)`;
	} else {
		// console.log('No types selected, returning empty array');
		return [];
	}
	
	// Add stat command to get detailed information
	command += ' -exec stat -c "%n\\t%Y\\t%s\\t%F" {} \\;';
	console.log('findFiles: command =', command);
	try {
		const { stdout, stderr } = await execAsync(command);
		if (stderr) {
			console.error('findFiles: error:', stderr);
			throw new Error(`Find command error: ${stderr}`);
		}
		if (!stdout.trim()) {
			// console.log('findFiles: no results');
			return [];
		}
		const results: FileInfo[] = [];
		
		// Parse find command output
		for (const line of stdout.split('\n')) {
			if (!line.trim()) continue;
			const parts = line.split(/\\t|\t/);
			if (parts.length < 4) continue;
			const [fullPath, mtime, size, type] = parts;
			if (!fullPath || !mtime || !size || !type) continue;
			const relativePath = path.relative(dirPath, fullPath);
			const isDirectory = type.includes('directory');
			
			// Check for subdirectories
			let hasSubDirs = false;
			if (isDirectory) {
				try {
					const { stdout: lsOutput } = await execAsync(`ls -A "${fullPath}"`);
					hasSubDirs = lsOutput.split('\n').some(item => {
						if (!item.trim()) return false;
						const itemPath = path.join(fullPath, item);
						return fs.existsSync(itemPath) && fs.statSync(itemPath).isDirectory();
					});
				} catch (_) {
					// 忽略子目录检查错误
				}
			}

			// 如果是目录且启用了 onlyLeafDirs，则跳过有子目录的目录
			if (isDirectory && onlyLeafDirs && hasSubDirs) {
				continue;
			}

			const fileInfo: FileInfo = {
				name: path.basename(fullPath),
				path: isDirectory ? fullPath + '/' : fullPath,
				parent: path.dirname(fullPath) + '/',
				type: isDirectory ? 'directory' : 'file',
				size: parseInt(size, 10) || 0,
				mtime: new Date(parseInt(mtime, 10) * 1000),
				depth: relativePath.split(path.sep).length,
				hasSubDirs,
			};

			// 应用正则表达式过滤
			if (filter) {
				try {
					const regex = new RegExp(filter);
					if (!regex.test(fileInfo.name)) {
						continue;
					}
				} catch (_) {
					// 忽略无效正则
				}
			}
			results.push(fileInfo);
		}
		// console.log(`findFiles: found ${results.length} files/directories`);

		// 应用排序
		results.sort((a, b) => {
			let comparison = 0;
			switch (sortBy) {
				case 'name':
					comparison = a.name.localeCompare(b.name);
					break;
				case 'mtime':
					comparison = a.mtime.getTime() - b.mtime.getTime();
					break;
				case 'type':
					comparison = a.type.localeCompare(b.type);
					break;
				case 'size':
					comparison = a.size - b.size;
					break;
				case 'depth':
					comparison = a.depth - b.depth;
					break;
				case 'path':
					comparison = a.path.localeCompare(b.path);
					break;
				case 'parent':
					comparison = a.parent.localeCompare(b.parent);
					break;
				default:
					return 0;
			}
			return sortDirection === 'asc' ? comparison : -comparison;
		});

		// 限制返回记录数
		return results.slice(0, maxRecords);
	} catch (error) {
		const errorMsg = `findFiles: exception: ${error.message}`;
		console.error(errorMsg);
		throw new Error(errorMsg);
	}
} 