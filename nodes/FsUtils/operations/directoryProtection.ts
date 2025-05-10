import * as path from 'path';

// 定义受保护的系统目录
export const PROTECTED_DIRS = [
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

// 目录深度限制
export const MIN_DIRECTORY_DEPTH = 3;
export const MAX_DIRECTORY_DEPTH = 10;

// 默认配置
export const DEFAULT_PROTECTION_CONFIG = {
	minDepth: MIN_DIRECTORY_DEPTH,  // 最小目录深度
	maxDepth: MAX_DIRECTORY_DEPTH, // 最大目录深度
	allowProtectedDirs: false, // 是否允许操作受保护的系统目录
};

export interface DirectoryProtectionConfig {
	minDepth?: number;
	maxDepth?: number;
	allowProtectedDirs?: boolean;
}

// 检查目录深度
export function checkDirectoryDepth(dirPath: string, config: DirectoryProtectionConfig = {}): boolean {
	const normalizedPath = path.normalize(dirPath);
	const pathParts = normalizedPath.split(path.sep).filter(part => part !== '');
	
	const minDepth = config.minDepth ?? DEFAULT_PROTECTION_CONFIG.minDepth;
	const maxDepth = config.maxDepth ?? DEFAULT_PROTECTION_CONFIG.maxDepth;
	
	// 计算目录深度
	const depth = pathParts.length;
	
	// 检查深度是否在允许范围内
	if (depth < minDepth || depth > maxDepth) {
		throw new Error(`Directory depth must be between ${minDepth} and ${maxDepth}, current depth: ${depth}`);
	}

	return true;
}

// 检查是否是受保护的系统目录
export function isProtectedDirectory(dirPath: string, config: DirectoryProtectionConfig = {}): boolean {
	const normalizedPath = path.normalize(dirPath);
	
	// 如果允许操作受保护目录，直接返回 false
	if (config.allowProtectedDirs ?? DEFAULT_PROTECTION_CONFIG.allowProtectedDirs) {
		return false;
	}

	return PROTECTED_DIRS.some(protectedDir => {
		const normalizedProtectedDir = path.normalize(protectedDir);
		return normalizedPath === normalizedProtectedDir || 
			normalizedPath.startsWith(normalizedProtectedDir + path.sep);
	});
}

// 检查目录是否安全
export function checkDirectorySafety(dirPath: string, config: DirectoryProtectionConfig = {}): void {
	// 检查是否是受保护的系统目录
	if (isProtectedDirectory(dirPath, config)) {
		throw new Error(`Operation on system directory is not allowed: ${dirPath}`);
	}

	// 检查目录深度
	checkDirectoryDepth(dirPath, config);
} 