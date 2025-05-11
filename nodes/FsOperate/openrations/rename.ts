import * as fs from 'fs';
import * as path from 'path';

interface RenameOptions {
    sourcePath: string;
    targetPath: string;
    pattern?: string;
    replacement?: string;
}

export async function rename(options: RenameOptions): Promise<{ renamed: string | null }> {
    const { sourcePath, targetPath, pattern, replacement } = options;

    // 确保目标目录存在
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

    // 检查源路径是文件还是目录
    const stats = await fs.promises.stat(sourcePath);

    if (stats.isFile()) {
        let finalTargetPath = targetPath;
        let isRenamed = false;
        
        // 如果提供了pattern和replacement，进行正则替换
        if (pattern && replacement) {
            const regex = new RegExp(pattern);
            const fileName = path.basename(targetPath);
            if (regex.test(fileName)) {
                const newFileName = fileName.replace(regex, replacement);
                finalTargetPath = path.join(path.dirname(targetPath), newFileName);
                isRenamed = true;
            }
        }

        await fs.promises.rename(sourcePath, finalTargetPath);
        if (isRenamed || sourcePath !== finalTargetPath) {
            return { renamed: finalTargetPath };
        }
    } else if (stats.isDirectory()) {
        let finalTargetPath = targetPath;
        let isRenamed = false;
        
        // 如果提供了pattern和replacement，进行正则替换
        if (pattern && replacement) {
            const regex = new RegExp(pattern);
            const dirName = path.basename(sourcePath);
            if (regex.test(dirName)) {
                const newDirName = dirName.replace(regex, replacement);
                finalTargetPath = path.join(path.dirname(targetPath), newDirName);
                isRenamed = true;
            }
        }

        await fs.promises.rename(sourcePath, finalTargetPath);
        if (isRenamed || sourcePath !== finalTargetPath) {
            return { renamed: finalTargetPath };
        }
    }

    return { renamed: undefined };
} 