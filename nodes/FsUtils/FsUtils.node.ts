import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { listDirectory } from '../FsUtils/operations/listDirectory';
import { cleanEmptyDirectories } from '../FsUtils/operations/cleanEmptyDirectories';
import { fixFileNames } from '../FsUtils/operations/fixFileNames';
import { deleteFiles, COMMON_FILE_EXTENSIONS } from '../FsUtils/operations/deleteFiles';
import { moveFiles } from '../FsUtils/operations/moveFiles';
import { flattenDirectory } from '../FsUtils/operations/flattenDirectory';
import { readFile } from '../FsUtils/operations/readFile';
import { rename } from '../FsUtils/operations/rename';
import { DEFAULT_PROTECTION_CONFIG, MIN_DIRECTORY_DEPTH, MAX_DIRECTORY_DEPTH } from '../FsUtils/operations/directoryProtection';

export class FsUtils implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FileUtils',
		name: 'fsUtils',
		icon: 'file:FsUtils.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'File system operations utility',
		defaults: {
			name: 'File System Utils',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'List Directory',
						value: 'listDirectory',
						description: 'List files and folders in a directory',
					},
					{
						name: 'Clean Empty Directories',
						value: 'cleanEmptyDirectories',
						description: 'Clean empty directories recursively',
					},
					{
						name: 'Fix File Names',
						value: 'fixFileNames',
						description: 'Fix file names that are incompatible with Windows',
					},
					{
						name: 'Delete Files',
						value: 'deleteFiles',
						description: 'Delete files',
					},
					{
						name: 'Move Files',
						value: 'moveFiles',
						description: 'Move files to another location',
					},
					{
						name: 'Flatten Directory',
						value: 'flattenDirectory',
						description: 'Flatten directory structure by moving all files to root directory',
					},
					{
						name: 'Read File',
						value: 'readFile',
						description: 'Read file content',
					},
					{
						name: 'Rename',
						value: 'rename',
						description: 'Rename files or directories with pattern matching',
					},
				],
				default: 'listDirectory',
			},
			{
				displayName: 'Directory Path',
				name: 'directoryPath',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['listDirectory', 'cleanEmptyDirectories', 'fixFileNames', 'deleteFiles', 'flattenDirectory'],
					},
				},
			},
			{
				displayName: 'Source Directory',
				name: 'sourceDir',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['moveFiles'],
					},
				},
			},
			{
				displayName: 'Target Directory',
				name: 'targetDir',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['moveFiles'],
					},
				},
			},
			{
				displayName: 'Pattern',
				name: 'pattern',
				type: 'string',
				default: '',
				description: 'Regular expression pattern to match files/directories',
				required: false,
				displayOptions: {
					show: {
						operation: ['deleteFiles', 'moveFiles'],
					},
				},
			},
			{
				displayName: 'Recursive',
				name: 'recursive',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						operation: ['deleteFiles', 'moveFiles', 'cleanEmptyDirectories', 'fixFileNames'],
					},
				},
			},
			{
				displayName: 'Only Directories',
				name: 'onlyDirectories',
				type: 'boolean',
				default: false,
				description: 'Only fix directory names, skip files',
				displayOptions: {
					show: {
						operation: ['fixFileNames'],
					},
				},
			},
			{
				displayName: 'Include Files',
				name: 'includeFiles',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						operation: ['deleteFiles', 'moveFiles'],
					},
				},
			},
			{
				displayName: 'Include sub Directories',
				name: 'includeDirectories',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['deleteFiles', 'moveFiles'],
					},
				},
			},
			{
				displayName: 'Rename Only',
				name: 'renameOnly',
				type: 'boolean',
				default: false,
				description: 'Only rename the source file/directory without processing its contents',
				displayOptions: {
					show: {
						operation: ['moveFiles'],
					},
				},
			},
			{
				displayName: 'Delete Root Directory',
				name: 'deleteRootDir',
				type: 'boolean',
				default: false,
				description: 'Delete the input directory itself after processing its contents',
				displayOptions: {
					show: {
						operation: ['deleteFiles']
					},
				},
			},
			{
				displayName: 'Use Shell Command',
				name: 'useShell',
				type: 'boolean',
				default: false,
				description: 'Use shell commands for faster file deletion (Linux/Unix systems only)',
				displayOptions: {
					show: {
						operation: ['deleteFiles']
					},
				},
			},
			{
				displayName: 'File Extensions',
				name: 'fileExtensions',
				type: 'multiOptions',
				description: 'Select file extensions to delete (multiple selection allowed)',
				default: [],
				options: COMMON_FILE_EXTENSIONS,
				displayOptions: {
					show: {
						operation: ['deleteFiles'],
						useShell: [true]
					},
				},
			},
			{
				displayName: 'Custom Extensions',
				name: 'customExtensions',
				type: 'string',
				default: '',
				description: 'Custom file extensions (comma-separated, e.g., bak,old,temp)',
				displayOptions: {
					show: {
						operation: ['deleteFiles'],
						useShell: [true]
					},
				},
			},
			{
				displayName: 'Show Files',
				name: 'showFiles',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						operation: ['listDirectory'],
					},
				},
			},
			{
				displayName: 'Show Directories',
				name: 'showDirectories',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						operation: ['listDirectory'],
					},
				},
			},
			{
				displayName: 'Filter Pattern',
				name: 'filter',
				type: 'string',
				default: '',
				description: 'Regular expression pattern to filter file names',
				displayOptions: {
					show: {
						operation: ['listDirectory'],
					},
				},
			},
			{
				displayName: 'Sort By',
				name: 'sortBy',
				type: 'options',
				options: [
					{
						name: 'Name',
						value: 'name',
					},
					{
						name: 'Modified Time',
						value: 'mtime',
					},
					{
						name: 'Type',
						value: 'type',
					},
				],
				default: 'name',
				displayOptions: {
					show: {
						operation: ['listDirectory'],
					},
				},
			},
			{
				displayName: 'Max Depth',
				name: 'maxDepth',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 9,
				},
				default: 1,
				description: 'The maximum depth of directory traversal (1-9, 1 means only traverse the current directory)',
				displayOptions: {
					show: {
						operation: ['listDirectory'],
					},
				},
			},
			{
				displayName: 'Only Leaf Directories',
				name: 'onlyLeafDirs',
				type: 'boolean',
				default: false,
				description: 'Only display directories that do not contain subdirectories (leaf directories)',
				displayOptions: {
					show: {
						operation: ['listDirectory'],
					},
				},
			},
			{
				displayName: 'Return as List',
				name: 'returnAsArray',
				type: 'boolean',
				default: false,
				description: 'Return results as an list instead of an object',
				displayOptions: {
					show: {
						operation: ['listDirectory', 'deleteFiles', 'moveFiles', 'flattenDirectory'],
					},
				},
			},
			{
				displayName: 'Fix Path Names',
				name: 'fixPathName',
				type: 'boolean',
				default: false,
				description: 'Whether to fix path names that are incompatible with Windows',
				displayOptions: {
					show: {
						operation: ['listDirectory'],
					},
				},
			},
			{
				displayName: 'File Path',
				name: 'filePath',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['readFile'],
					},
				},
				description: '要读取的文件路径',
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				options: [
					{
						name: 'Auto Detect',
						value: 'auto',
						description: '自动检测文件类型并选择合适的输出格式',
					},
					{
						name: 'Base64',
						value: 'base64',
						description: '始终以Base64格式输出',
					},
					{
						name: 'Binary',
						value: 'binary',
						description: '始终以二进制格式输出',
					},
				],
				default: 'auto',
				displayOptions: {
					show: {
						operation: ['readFile'],
					},
				},
				description: '选择输出格式',
			},
			{
				displayName: 'Custom Field Names',
				name: 'customFieldNames',
				type: 'collection',
				default: {},
				displayOptions: {
					show: {
						operation: ['readFile'],
					},
				},
				description: '自定义输出字段的名称',
				options: [
					{
						displayName: 'Name Field',
						name: 'nameField',
						type: 'string',
						default: 'name',
						description: '文件名字段的名称',
					},
					{
						displayName: 'MIME Type Field',
						name: 'mimeTypeField',
						type: 'string',
						default: 'mime_type',
						description: 'MIME类型字段的名称',
					},
					{
						displayName: 'Content Field',
						name: 'contentField',
						type: 'string',
						default: 'content',
						description: '文本内容字段的名称',
					},
					{
						displayName: 'Base64 Field',
						name: 'base64Field',
						type: 'string',
						default: 'base64',
						description: 'Base64内容字段的名称',
					},
					{
						displayName: 'Size Field',
						name: 'sizeField',
						type: 'string',
						default: 'size',
						description: '文件大小字段的名称',
					},
				],
			},
			{
				displayName: 'Source Path',
				name: 'sourcePath',
				type: 'string',
				default: '',
				description: 'files/directories absolute path',
				required: true,
				displayOptions: {
					show: {
						operation: ['rename'],
					},
				},
			},
			{
				displayName: 'Target Path',
				name: 'targetPath',
				type: 'string',
				default: '',
				description: 'files/directories rename to absolute path',
				required: true,
				displayOptions: {
					show: {
						operation: ['rename'],
					},
				},
			},
			{
				displayName: 'Pattern',
				name: 'renamePattern',
				type: 'string',
				default: '',
				description: 'Regular expression pattern to match files/directories',
				required: false,
				displayOptions: {
					show: {
						operation: ['rename'],
					},
				},
			},
			{
				displayName: 'Replacement',
				name: 'replacement',
				type: 'string',
				default: '',
				description: 'Replacement string for matched Regular expression pattern',
				required: false,
				displayOptions: {
					show: {
						operation: ['rename'],
					},
				},
			},
			{
				displayName: 'Return as List',
				name: 'returnAsArray',
				type: 'boolean',
				default: false,
				description: 'Return results as an list instead of an object',
				displayOptions: {
					show: {
						operation: ['rename'],
					},
				},
			},
			{
				displayName: 'Directory Protection',
				name: 'directoryProtection',
				type: 'collection',
				default: {
					minDepth: DEFAULT_PROTECTION_CONFIG.minDepth,
					maxDepth: DEFAULT_PROTECTION_CONFIG.maxDepth,
					allowProtectedDirs: DEFAULT_PROTECTION_CONFIG.allowProtectedDirs,
				},
				description: 'Directory protection configuration',
				displayOptions: {
					show: {
						operation: ['cleanEmptyDirectories', 'fixFileNames', 'deleteFiles', 'moveFiles', 'flattenDirectory', 'rename'],
					},
				},
				options: [
					{
						displayName: 'Minimum Directory Depth',
						name: 'minDepth',
						type: 'number',
						default: DEFAULT_PROTECTION_CONFIG.minDepth,
						typeOptions: {
							minValue: MIN_DIRECTORY_DEPTH,
							maxValue: MAX_DIRECTORY_DEPTH,
						},
						description: `最小允许的目录深度（不能低于${MIN_DIRECTORY_DEPTH}层）`,
					},
					{
						displayName: 'Maximum Directory Depth',
						name: 'maxDepth',
						type: 'number',
						default: DEFAULT_PROTECTION_CONFIG.maxDepth,
						typeOptions: {
							minValue: MIN_DIRECTORY_DEPTH,
							maxValue: MAX_DIRECTORY_DEPTH,
						},
						description: `最大允许的目录深度（不能超过${MAX_DIRECTORY_DEPTH}层）`,
					},
					{
						displayName: 'Allow Protected Directories',
						name: 'allowProtectedDirs',
						type: 'boolean',
						default: DEFAULT_PROTECTION_CONFIG.allowProtectedDirs,
						description: 'Whether to allow operations on protected system directories',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'listDirectory') {
					const directoryPath = this.getNodeParameter('directoryPath', i) as string;
					const showFiles = this.getNodeParameter('showFiles', i) as boolean;
					const showDirectories = this.getNodeParameter('showDirectories', i) as boolean;
					const filter = this.getNodeParameter('filter', i) as string;
					const sortBy = this.getNodeParameter('sortBy', i) as string;
					const maxDepth = this.getNodeParameter('maxDepth', i) as number;
					const onlyLeafDirs = this.getNodeParameter('onlyLeafDirs', i) as boolean;
					const returnAsArray = this.getNodeParameter('returnAsArray', i) as boolean;
					const fixPathName = this.getNodeParameter('fixPathName', i) as boolean;

					const result = await listDirectory({
						dirPath: directoryPath,
						showFiles,
						showDirectories,
						filter,
						sortBy,
						maxDepth,
						onlyLeafDirs,
						fixPathName,
					});
					if (returnAsArray) {
						const arrayItems = Object.values(result).map(item => ({
							json: { ...item } as IDataObject
						}));
						returnData.push(...arrayItems);
					} else {
						returnData.push({
							json: { files: result }
						});
					}
				} else if (operation === 'readFile') {
					const filePath = this.getNodeParameter('filePath', i) as string;
					const outputFormat = this.getNodeParameter('outputFormat', i) as string;
					const customFieldNames = this.getNodeParameter('customFieldNames', i) as {
						nameField: string;
						mimeTypeField: string;
						contentField: string;
						base64Field: string;
						sizeField: string;
					};

					const result = await readFile({ filePath });
					const formattedResult = {
						[customFieldNames.nameField]: result.name,
						[customFieldNames.mimeTypeField]: result.mimeType,
						[customFieldNames.contentField]: result.content,
						[customFieldNames.base64Field]: result.base64,
						[customFieldNames.sizeField]: result.size,
					};

					if (outputFormat === 'auto') {
						const mimeType = result.mimeType as string;
						if (mimeType.startsWith('image/')) {
							returnData.push({
								json: {
									...formattedResult,
									mimeType: result.mimeType,
									content: result.base64,
									image: true,
								},
							});
						} else if (mimeType.startsWith('video/')) {
							returnData.push({
								json: {
									...formattedResult,
									mimeType: result.mimeType,
									content: result.base64,
									video: true,
								},
							});
						} else if (mimeType.startsWith('audio/')) {
							returnData.push({
								json: {
									...formattedResult,
									mimeType: result.mimeType,
									content: result.base64,
									audio: true,
								},
							});
						} else {
							returnData.push({
								json: formattedResult,
							});
						}
					} else if (outputFormat === 'base64') {
						returnData.push({
							json: {
								...formattedResult,
								mimeType: result.mimeType,
								content: result.base64,
							},
						});
					} else if (outputFormat === 'binary') {
						returnData.push({
							json: {
								...formattedResult,
								mimeType: result.mimeType,
								content: result.base64,
							},
						});
					}
				} else if (operation === 'cleanEmptyDirectories' || 
					operation === 'fixFileNames' || 
					operation === 'deleteFiles' || 
					operation === 'moveFiles' || 
					operation === 'flattenDirectory' || 
					operation === 'rename') {
					// 获取目录保护配置
					const protectionConfig = this.getNodeParameter('directoryProtection', i) as {
						minDepth?: number;
						maxDepth?: number;
						allowProtectedDirs?: boolean;
					};

					if (operation === 'cleanEmptyDirectories') {
						const directoryPath = this.getNodeParameter('directoryPath', i) as string;
						const recursive = this.getNodeParameter('recursive', i) as boolean;
						
						await cleanEmptyDirectories(directoryPath, recursive, protectionConfig);
						returnData.push({
							json: {
								success: true,
								message: 'Empty directories cleaned successfully',
								dirPath: directoryPath,
							},
						});
					} else if (operation === 'fixFileNames') {
						const directoryPath = this.getNodeParameter('directoryPath', i) as string;
						const recursive = this.getNodeParameter('recursive', i) as boolean;
						const onlyDirectories = this.getNodeParameter('onlyDirectories', i) as boolean;
						
						const results = await fixFileNames(directoryPath, recursive, onlyDirectories);
						
						// 检查是否有失败的结果
						const failedResults = results.filter(result => !result.success);
						const successCount = results.length - failedResults.length;
						
						returnData.push({
							json: {
								success: failedResults.length === 0,
								message: failedResults.length === 0 
									? `Successfully fixed ${successCount} file names` 
									: `Fixed ${successCount} file names, but ${failedResults.length} failed`,
								results,
								dirPath: directoryPath,
								failedResults: failedResults.length > 0 ? failedResults : undefined
							},
						});
					} else if (operation === 'deleteFiles') {
						const directoryPath = this.getNodeParameter('directoryPath', i) as string;
						const pattern = this.getNodeParameter('pattern', i) as string;
						const recursive = this.getNodeParameter('recursive', i) as boolean;
						const includeFiles = this.getNodeParameter('includeFiles', i) as boolean;
						const includeDirectories = this.getNodeParameter('includeDirectories', i) as boolean;
						const deleteRootDir = this.getNodeParameter('deleteRootDir', i) as boolean;
						const returnAsArray = this.getNodeParameter('returnAsArray', i) as boolean;
						const filePath = this.getNodeParameter('filePath', i) as string;
						const useShell = this.getNodeParameter('useShell', i) as boolean;
						const fileExtensions = this.getNodeParameter('fileExtensions', i) as string[];
						const customExtensions = this.getNodeParameter('customExtensions', i) as string;

						// 合并预定义和自定义的文件后缀
						const allExtensions = [
							...(fileExtensions || []),
							...(customExtensions ? customExtensions.split(',').map(ext => ext.trim()) : [])
						];

						if (deleteRootDir) {
							const fs = require('fs');
							await fs.promises.rmdir(directoryPath, { recursive: true });
							if (returnAsArray) {
								returnData.push({ json: { path: directoryPath } });
							} else {
								returnData.push({ json: { deleted: [directoryPath] } });
							}
							continue;
						}

						const result = await deleteFiles({
							dirPath: directoryPath,
							pattern,
							recursive,
							includeFiles,
							includeDirectories,
							deleteRootDir,
							useShell,
							fileExtensions: allExtensions,
							protectionConfig,
						});

						if (returnAsArray) {
							const arrayItems = result.deleted.map(item => ({
								json: { path: item } as IDataObject
							}));
							returnData.push(...arrayItems);
						} else {
							returnData.push({
								json: { deleted: result.deleted }
							});
						}
					} else if (operation === 'moveFiles') {
						const sourceDir = this.getNodeParameter('sourceDir', i) as string;
						const targetDir = this.getNodeParameter('targetDir', i) as string;
						const pattern = this.getNodeParameter('pattern', i) as string;
						const recursive = this.getNodeParameter('recursive', i) as boolean;
						const includeFiles = this.getNodeParameter('includeFiles', i) as boolean;
						const includeDirectories = this.getNodeParameter('includeDirectories', i) as boolean;
						const returnAsArray = this.getNodeParameter('returnAsArray', i) as boolean;

						const result = await moveFiles({
							sourcePath: sourceDir,
							targetDir,
							pattern,
							recursive,
							includeFiles,
							includeDirectories,
							protectionConfig,
						});

						if (returnAsArray) {
							const arrayItems = result.moved.map(item => ({
								json: { path: item } as IDataObject
							}));
							returnData.push(...arrayItems);
						} else {
							returnData.push({
								json: { moved: result.moved }
							});
						}
					} else if (operation === 'flattenDirectory') {
						const directoryPath = this.getNodeParameter('directoryPath', i) as string;
						const returnAsArray = this.getNodeParameter('returnAsArray', i) as boolean;
						
						const results = await flattenDirectory(directoryPath, protectionConfig);
						if (returnAsArray) {
							const arrayItems = results.map(item => ({
								json: { ...item } as IDataObject
							}));
							returnData.push(...arrayItems);
						} else {
							returnData.push({
								json: { results }
							});
						}
					} else if (operation === 'rename') {
						const sourcePath = this.getNodeParameter('sourcePath', i) as string;
						const targetPath = this.getNodeParameter('targetPath', i) as string;
						const renamePattern = this.getNodeParameter('renamePattern', i) as string;
						const replacement = this.getNodeParameter('replacement', i) as string;
						const returnAsArray = this.getNodeParameter('returnAsArray', i) as boolean;

						const result = await rename({
							sourcePath,
							targetPath,
							pattern: renamePattern,
							replacement,
						});

						if (returnAsArray) {
							const arrayItems = result.renamed.map(item => ({
								json: { path: item } as IDataObject
							}));
							returnData.push(...arrayItems);
						} else {
							returnData.push({
								json: { renamed: result.renamed }
							});
						}
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
} 