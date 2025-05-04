import * as fs from 'fs';
import * as path from 'path';
import { Buffer } from 'buffer';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface FileProcessResult {
	originalPath: string;
	newPath: string;
	type: 'file' | 'directory';
	success: boolean;
	error?: string;
}

/**
 * 修复文件名，使其与Windows兼容
 * @param dirPath 要处理的目录路径
 * @param recursive 是否递归处理子目录
 * @param onlyDirectories 是否只处理目录，不处理文件
 * @returns 处理结果数组
 */
export async function fixFileNames(dirPath: string, recursive: boolean = true, onlyDirectories: boolean = false): Promise<FileProcessResult[]> {
	const results: FileProcessResult[] = [];
	
	try {
		// 使用iconv命令处理文件名编码问题
		// 首先尝试使用iconv命令转换文件名
		try {
			// 构建iconv命令，将文件名从UTF-8转换为UTF-8（实际上是为了处理编码问题）
			const iconvCommand = `find "${dirPath}" ${recursive ? '' : '-maxdepth 1'} ${onlyDirectories ? '-type d' : '-type f -o -type d'} -print0 | while IFS= read -r -d '' file; do
				dir=$(dirname "$file")
				name=$(basename "$file")
				# 使用iconv处理文件名
				new_name=$(echo "$name" | iconv -f UTF-8 -t UTF-8//IGNORE)
				# 如果文件名需要修改
				if [ "$name" != "$new_name" ]; then
					mv "$file" "$dir/$new_name"
					echo "Renamed: $file -> $dir/$new_name"
				fi
			done`;
			
			await execAsync(iconvCommand);
			
			// 收集处理结果
			const { stdout } = await execAsync(`find "${dirPath}" ${recursive ? '' : '-maxdepth 1'} ${onlyDirectories ? '-type d' : '-type f -o -type d'}`);
			const filePaths = stdout.trim().split('\n').filter(Boolean);
			
			for (const filePath of filePaths) {
				if (filePath === dirPath) continue;
				
				results.push({
					originalPath: filePath,
					newPath: filePath,
					type: fs.statSync(filePath).isDirectory() ? 'directory' : 'file',
					success: true
				});
			}
		} catch (error) {
			console.error('执行iconv命令时出错:', error);
			// 如果iconv命令失败，尝试使用mv命令直接处理
			try {
				// 使用mv命令直接处理文件名
				const mvCommand = `find "${dirPath}" ${recursive ? '' : '-maxdepth 1'} ${onlyDirectories ? '-type d' : '-type f -o -type d'} -print0 | while IFS= read -r -d '' file; do
					dir=$(dirname "$file")
					name=$(basename "$file")
					# 使用mv命令直接重命名，让系统处理编码问题
					mv "$file" "$dir/$(echo "$name" | tr -cd '[:alnum:][:space:][:punct:]')" 2>/dev/null || true
				done`;
				
				await execAsync(mvCommand);
				
				// 收集处理结果
				const { stdout } = await execAsync(`find "${dirPath}" ${recursive ? '' : '-maxdepth 1'} ${onlyDirectories ? '-type d' : '-type f -o -type d'}`);
				const filePaths = stdout.trim().split('\n').filter(Boolean);
				
				for (const filePath of filePaths) {
					if (filePath === dirPath) continue;
					
					results.push({
						originalPath: filePath,
						newPath: filePath,
						type: fs.statSync(filePath).isDirectory() ? 'directory' : 'file',
						success: true
					});
				}
			} catch (mvError) {
				console.error('执行mv命令时出错:', mvError);
				// 如果mv命令也失败，回退到备用方法
				return fixFileNamesFallback(dirPath, recursive, onlyDirectories);
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`处理目录 "${dirPath}" 时出错:`, error);
		throw error;
	}
	
	return results;
}

/**
 * 备用方法：使用Node.js原生方法修复文件名
 * @param dirPath 要处理的目录路径
 * @param recursive 是否递归处理子目录
 * @param onlyDirectories 是否只处理目录，不处理文件
 * @returns 处理结果数组
 */
async function fixFileNamesFallback(dirPath: string, recursive: boolean = true, onlyDirectories: boolean = false): Promise<FileProcessResult[]> {
	const results: FileProcessResult[] = [];
	
	try {
		// 使用 { withFileTypes: true } 选项获取更详细的文件信息
		const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
		
		for (const entry of entries) {
			try {
				// 如果只处理目录，跳过文件
				if (onlyDirectories && !entry.isDirectory()) continue;
				
				const fullPath = path.join(dirPath, entry.name);
				
				const result: FileProcessResult = {
					originalPath: fullPath,
					newPath: fullPath,
					type: entry.isDirectory() ? 'directory' : 'file',
					success: true
				};
				
				// 先尝试修复文件名
				const newName = sanitizeFileName(entry.name);
				
				// 如果文件名需要修改
				if (newName !== entry.name) {
					const newPath = path.join(dirPath, newName);
					
					// 检查目标路径是否已存在
					try {
						await fs.promises.access(newPath);
						// 如果文件已存在，添加时间戳以避免冲突
						const timestamp = new Date().getTime();
						const ext = path.extname(newName);
						const baseName = path.basename(newName, ext);
						const uniqueName = `${baseName}_${timestamp}${ext}`;
						const uniquePath = path.join(dirPath, uniqueName);
						
						await fs.promises.rename(fullPath, uniquePath);
						result.newPath = uniquePath;
						result.success = true;
					} catch (accessError) {
						// 文件不存在，可以安全重命名
						await fs.promises.rename(fullPath, newPath);
						result.newPath = newPath;
						result.success = true;
					}
				}
				
				// 如果是目录且需要递归处理
				if (entry.isDirectory() && recursive) {
					// 使用新的路径（如果已重命名）
					const subDirPath = result.newPath;
					const subResults = await fixFileNamesFallback(subDirPath, recursive, onlyDirectories);
					results.push(...subResults);
				}
				
				results.push(result);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				results.push({
					originalPath: path.join(dirPath, entry.name),
					newPath: path.join(dirPath, entry.name),
					type: entry.isDirectory() ? 'directory' : 'file',
					success: false,
					error: errorMessage
				});
				console.error(`处理文件 "${entry.name}" 时出错:`, error);
				continue;
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`读取目录 "${dirPath}" 时出错:`, error);
		throw error;
	}
	
	return results;
}

/**
 * 清理文件名，使其与Windows兼容
 * @param fileName 原始文件名
 * @returns 清理后的文件名
 */
function sanitizeFileName(fileName: string): string {
	try {
		// 生成一个安全的文件名
		let safeFileName = '';
		
		// 替换所有非ASCII字符为下划线
		for (let i = 0; i < fileName.length; i++) {
			const char = fileName.charAt(i);
			const charCode = fileName.charCodeAt(i);
			
			// 保留ASCII字符、数字和基本标点
			if ((charCode >= 32 && charCode <= 126) || 
				(charCode >= 0x4E00 && charCode <= 0x9FFF) || // 中文字符范围
				(charCode >= 0x3040 && charCode <= 0x309F) || // 平假名
				(charCode >= 0x30A0 && charCode <= 0x30FF)) { // 片假名
				safeFileName += char;
			} else {
				safeFileName += '_';
			}
		}
		
		// 替换 Windows 不支持的字符
		safeFileName = safeFileName.replace(/[<>:"/\\|?*]/g, '_');
		
		// 替换连续的下划线
		safeFileName = safeFileName.replace(/_+/g, '_');
		
		// 确保文件名不为空
		if (!safeFileName.trim()) {
			safeFileName = 'unnamed_file';
		}
		
		// 确保文件名不超过255个字符
		if (safeFileName.length > 255) {
			const ext = path.extname(safeFileName);
			const baseName = path.basename(safeFileName, ext);
			safeFileName = baseName.substring(0, 255 - ext.length) + ext;
		}
		
		return safeFileName;
	} catch (error) {
		console.error('文件名处理出错:', error);
		return 'unnamed_file';
	}
} 