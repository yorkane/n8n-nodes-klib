import * as fs from 'fs';
import * as path from 'path';
import { fixFileNames } from './fixFileNames';

export interface FlattenResult {
    originalPath: string;
    newPath: string;
    type: 'file' | 'directory';
    success: boolean;
}

export async function flattenDirectory(dirPath: string): Promise<FlattenResult[]> {
    const results: FlattenResult[] = [];
    
    try {
        // 首先修复目录名，确保可以访问所有目录
        await fixFileNames(dirPath, true, true);
        
        // 递归处理所有文件
        const processFiles = async (dir: string) => {
            const items = await fs.promises.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isFile()) {
                    // 仅处理非根目录的文件
                    if (dir !== dirPath) {
                        let newPath = path.join(dirPath, item.name);
                        let counter = 1;
                        
                        // 处理文件名冲突
                        while (await pathExists(newPath)) {
                            const ext = path.extname(item.name);
                            const basename = path.basename(item.name, ext);
                            newPath = path.join(dirPath, `${basename}_${counter}${ext}`);
                            counter++;
                        }
                        
                        try {
                            await fs.promises.rename(fullPath, newPath);
                            results.push({
                                originalPath: fullPath,
                                newPath,
                                type: 'file',
                                success: true
                            });
                        } catch (error) {
                            results.push({
                                originalPath: fullPath,
                                newPath,
                                type: 'file',
                                success: false
                            });
                        }
                    }
                } else if (item.isDirectory()) {
                    await processFiles(fullPath);
                }
            }
        };
        
        await processFiles(dirPath);
        
        // 清理空目录
        const removeEmptyDirs = async (dir: string) => {
            const items = await fs.promises.readdir(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = await fs.promises.stat(fullPath);
                
                if (stat.isDirectory()) {
                    await removeEmptyDirs(fullPath);
                    const files = await fs.promises.readdir(fullPath);
                    if (files.length === 0 && fullPath !== dirPath) {
                        try {
                            await fs.promises.rmdir(fullPath);
                            results.push({
                                originalPath: fullPath,
                                newPath: '',
                                type: 'directory',
                                success: true
                            });
                        } catch (error) {
                            results.push({
                                originalPath: fullPath,
                                newPath: '',
                                type: 'directory',
                                success: false
                            });
                        }
                    }
                }
            }
        };
        
        await removeEmptyDirs(dirPath);
        
    } catch (error) {
        console.error(`处理目录 "${dirPath}" 时出错:`, error);
        throw error;
    }
    
    return results;
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await fs.promises.access(path);
        return true;
    } catch {
        return false;
    }
} 