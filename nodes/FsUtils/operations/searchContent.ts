import { IExecuteFunctions } from 'n8n-workflow';
import { exec } from 'child_process';
import { promisify } from 'util';
import utils from '../../../lib/utils';

const execAsync = promisify(exec);

export async function searchContent(
	this: IExecuteFunctions,
	filePaths: string,
	searchPattern: string,
	isRegex: boolean = false,
): Promise<{ filePath: string; lineNumber: number; content: string }[]> {
	try {
		// 将文件路径按换行符分割
		const files = filePaths.split('\n').map(path => path.trim()).filter(path => path);
		
		if (files.length === 0) {
			throw new Error('No valid file paths provided');
		}

		// 构建 grep 命令
		let command = 'grep';
		if (isRegex) {
			command += ' -E';
			// 当使用正则表达式时，不进行 shell 转义
			searchPattern = searchPattern.replace(/"/g, '\\"');
		} else {
			searchPattern = utils.convertToShellRegex(searchPattern);
		}
		// 添加 -H 选项来确保始终显示文件名
		// 添加 -n 选项来显示行号
		// 使用 -a 选项来处理二进制文件
		command += ` -H -n -a "${searchPattern}" ${files.map(file => `"${file}"`).join(' ')}`;

		console.log('Executing command:', command);
		const { stdout, stderr } = await execAsync(command);
		
		if (stderr) {
			console.warn('Grep stderr:', stderr);
		}
		
		if (!stdout.trim()) {
			return [];
		}

		// 解析输出
		const results = stdout.split('\n')
			.filter(line => line.trim() !== '')
			.map(line => {
				try {
					// grep 输出格式为: filePath:lineNumber:content
					const parts = line.split(':');
					if (parts.length < 3) {
						console.warn(`Invalid grep output format: ${line}`);
						return null;
					}
					
					const filePath = parts[0];
					const lineNumber = parseInt(parts[1], 10);
					const content = parts.slice(2).join(':').trim();
					
					if (isNaN(lineNumber)) {
						console.warn(`Invalid line number in output: ${line}`);
						return null;
					}
					
					return {
						filePath,
						lineNumber,
						content,
					};
				} catch (error) {
					console.error(`Error parsing grep output line: ${line}`, error);
					return null;
				}
			})
			.filter((result): result is { filePath: string; lineNumber: number; content: string } => 
				result !== null
			);

		// 如果没有有效结果，返回空数组
		if (results.length === 0) {
			return [];
		}

		return results;
	} catch (error: unknown) {
		// 如果 grep 没有找到匹配项，会返回非零退出码
		if (error instanceof Error && 'code' in error && error.code === 1) {
			return [];
		}
		throw error;
	}
} 