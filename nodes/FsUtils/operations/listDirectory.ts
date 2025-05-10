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
	showFiles?: boolean;      // 是否显示文件
	showDirectories?: boolean; // 是否显示目录
	maxDepth?: number;        // 遍历深度，默认为1，最大为9
	onlyLeafDirs?: boolean;   // 是否只显示末级目录（不包含子目录的目录）
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
	const items = await fs.promises.readdir(dirPath);
	for (const item of items) {
		const fullPath = path.join(dirPath, item);
		const stats = await fs.promises.stat(fullPath);
		if (stats.isDirectory()) {
			return true;
		}
	}
	return false;
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
			await listDirectoryRecursive(
				{ ...options, dirPath: fullPath },
				currentDepth + 1,
				results
			);
		}
	}
	return results;
}

/**
 * 列出目录内容
 */
export async function listDirectory(options: ListDirectoryOptions): Promise<FileInfo[]> {
	const {
		dirPath,
		sortBy,
		sortDirection,
		filter,
		showFiles = true,
		showDirectories = true,
		maxDepth = 1,
		onlyLeafDirs = false,
	} = options;

	// 获取展平的文件列表
	const results = await listDirectoryRecursive({
		dirPath,
		showFiles,
		showDirectories,
		filter,
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

	// 排序
	return filteredResults.sort((a, b) => {
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
} 