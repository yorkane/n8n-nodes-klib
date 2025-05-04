import * as fs from 'fs';
import * as path from 'path';

interface DeleteFilesOptions {
	dirPath: string;
	pattern?: string;
	recursive: boolean;
	includeFiles: boolean;
	includeDirectories: boolean;
}

export async function deleteFiles(options: DeleteFilesOptions): Promise<{ deleted: string[] }> {
	const { dirPath, pattern, recursive, includeFiles, includeDirectories } = options;
	const deleted: string[] = [];
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
	return { deleted };
} 