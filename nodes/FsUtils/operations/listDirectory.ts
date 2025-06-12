import * as fs from 'fs';
import * as path from 'path';
import { IDataObject } from 'n8n-workflow';

/**
 * 目录列表选项接口
 */
interface ListDirectoryOptions {
	dirPath: string;           // 目录路径
	sortBy: string;           // 排序方式
	sortDirection: 'asc' | 'desc'; // 排序方向
	filter?: string;          // 文件名过滤正则表达式
	excludePattern?: string;  // 排除文件名的正则表达式
	showFiles?: boolean;      // 是否显示文件
	showDirectories?: boolean; // 是否显示目录
	maxDepth?: number;        // 遍历深度，默认为1，最大为9
	onlyLeafDirs?: boolean;   // 是否只显示末级目录（不包含子目录的目录）
	maxRecords?: number;      // 最大返回记录数
	returnSingleObject?: boolean; // 返回单个对象而不是数组
}

/**
 * 文件信息接口
 */
interface FileInfo extends IDataObject {
	name: string;            // 文件名
	path: string;            // 文件路径
	parent: string;         // 父目录路径
	type: 'directory' | 'file'; // 类型
	size: number;           // 文件大小
	mtime: Date;           // 修改时间
	depth: number;         // 当前深度
	hasSubDirs?: boolean;  // 是否包含子目录
}

/**
 * 检查目录是否包含子目录
 */
async function hasSubDirectories(dirPath: string): Promise<boolean> {
	try {
		// Check directory permissions first
		await fs.promises.access(dirPath, fs.constants.R_OK);
		const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
		return entries.some(entry => entry.isDirectory());
	} catch (error: any) {
		// Ignore permission denied errors
		if (error.code === 'EACCES' || error.code === 'EPERM') {
			console.warn(`Permission denied for checking subdirectories in ${dirPath}`);
		}
		return false;
	}
}

/**
 * 递归遍历目录内容并展平结果
 */
async function listDirectoryRecursive(
	options: ListDirectoryOptions,
	currentDepth: number = 1,
	results: FileInfo[] = [],
): Promise<FileInfo[]> {
	const { dirPath, maxDepth = 1, onlyLeafDirs = false } = options;
	
	// 如果超过最大深度，返回当前结果
	if (currentDepth > Math.min(maxDepth, 9)) {
		return results;
	}
	
	try {
		// Check directory permissions first
		await fs.promises.access(dirPath, fs.constants.R_OK);
		const files = await fs.promises.readdir(dirPath);
		
		for (const file of files) {
			const fullPath = path.join(dirPath, file);
			const stats = await fs.promises.stat(fullPath);
			
			const isDirectory = stats.isDirectory();
			const hasSubDirs = isDirectory ? await hasSubDirectories(fullPath) : false;
			
			const fileInfo: FileInfo = {
				name: path.basename(fullPath),
				path: fullPath,
				parent: dirPath,
				type: isDirectory ? 'directory' : 'file',
				size: stats.size,
				mtime: stats.mtime,
				depth: currentDepth,
				hasSubDirs,
			};

			// 根据类型和条件过滤
			if (fileInfo.type === 'file' && options.showFiles) {
				results.push(fileInfo);
			} else if (fileInfo.type === 'directory' && options.showDirectories) {
				// 如果是只显示末级目录，则只添加不包含子目录的目录
				if (!onlyLeafDirs || !hasSubDirs) {
					results.push(fileInfo);
				}
			}

			// 如果是目录且未达到最大深度，递归遍历
			if (isDirectory && currentDepth < Math.min(maxDepth, 9)) {
				try {
					await listDirectoryRecursive(
						{ ...options, dirPath: fullPath },
						currentDepth + 1,
						results
					);
				} catch (error: any) {
					// Ignore permission errors for subdirectories
					if (error.code === 'EACCES' || error.code === 'EPERM') {
						console.warn(`Permission denied for subdirectory ${fullPath}, skipping...`);
					} else {
						console.error(`Error processing subdirectory ${fullPath}:`, error);
					}
				}
			}
		}
		return results;
	} catch (error: any) {
		// Ignore permission denied errors and continue
		if (error.code === 'EACCES' || error.code === 'EPERM') {
			console.warn(`Permission denied for directory ${dirPath}, skipping...`);
		} else {
			console.error(`Error reading directory ${dirPath}:`, error);
		}
		return results;
	}
}

/**
 * 列出目录内容
 */
export async function listDirectory(options: ListDirectoryOptions): Promise<FileInfo[] | FileInfo> {
	const {
		dirPath,
		sortBy,
		sortDirection,
		filter,
		excludePattern,
		showFiles = true,
		showDirectories = true,
		maxDepth = 1,
		onlyLeafDirs = false,
		maxRecords = 100,
		returnSingleObject = false,
	} = options;

	// 获取展平的文件列表
	const results = await listDirectoryRecursive({
		dirPath,
		showFiles,
		showDirectories,
		filter,
		excludePattern,
		sortBy,
		sortDirection,
		maxDepth: Math.min(Math.max(maxDepth, 1), 9),
		onlyLeafDirs,
	});

	// 应用名称过滤
	let filteredResults = results;
	if (filter) {
		const regex = new RegExp(filter);
		filteredResults = results.filter(file => regex.test(file.name));
	}

	// 应用排除过滤
	if (excludePattern) {
		try {
			const excludeRegex = new RegExp(excludePattern);
			filteredResults = filteredResults.filter(file => !excludeRegex.test(file.name));
		} catch (error) {
			// 忽略无效的正则表达式
			console.warn('Invalid exclude pattern regex:', excludePattern);
		}
	}

	// 排序
	const sortedResults = filteredResults.sort((a, b) => {
		let comparison = 0;
		switch (sortBy) {
			case 'name':
				comparison = a.name.localeCompare(b.name);
				break;
			case 'mtime':
				comparison = b.mtime.getTime() - a.mtime.getTime();
				break;
			case 'type':
				comparison = a.type.localeCompare(b.type);
				break;
			default:
				return 0;
		}
		return sortDirection === 'asc' ? comparison : -comparison;
	});

	// 限制返回记录数
	const finalResults = sortedResults.slice(0, maxRecords);
	
	// 如果设置了返回单个对象，返回第一个结果或空对象
	if (returnSingleObject) {
		return finalResults.length > 0 ? finalResults[0] : {
			name: '',
			path: '',
			parent: '',
			type: 'file' as const,
			size: 0,
			mtime: new Date(),
			depth: 0,
			hasSubDirs: false
		};
	}
	
	return finalResults;
}