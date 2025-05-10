import * as fs from 'fs';
import * as path from 'path';
import { fixFileNames } from './fixFileNames';
import { checkDirectorySafety, DirectoryProtectionConfig } from './directoryProtection';

export interface FlattenResult {
    originalPath: string;
    newPath: string;
    type: 'file' | 'directory';
    success: boolean;
}

export async function flattenDirectory(
	dirPath: string,
	protectionConfig?: DirectoryProtectionConfig
): Promise<Array<{ source: string; target: string }>> {
	// 检查目录安全性
	checkDirectorySafety(dirPath, protectionConfig);

	const results: FlattenResult[] = [];
    
    try {
        // First fix directory names to ensure all directories are accessible
        await fixFileNames(dirPath, true, true);
        
        // Process all files recursively
        const processFiles = async (dir: string) => {
            const items = await fs.promises.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isFile()) {
                    // Only process files that are not in the root directory
                    if (dir !== dirPath) {
                        let newPath = path.join(dirPath, item.name);
                        let counter = 1;
                        
                        // Handle filename conflicts
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
        
        // Clean up empty directories
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
        console.error(`Error processing directory "${dirPath}":`, error);
        throw error;
    }
    
    // Convert FlattenResult[] to { source: string; target: string }[]
    return results.map(result => ({
        source: result.originalPath,
        target: result.newPath
    }));
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await fs.promises.access(path);
        return true;
    } catch {
        return false;
    }
} 