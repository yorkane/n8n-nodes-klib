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
import { deleteFiles } from '../FsUtils/operations/deleteFiles';
import { moveFiles } from '../FsUtils/operations/moveFiles';
import { flattenDirectory } from '../FsUtils/operations/flattenDirectory';
import { readFile } from '../FsUtils/operations/readFile';

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
				displayName: 'Include Directories',
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
				description: 'The path of the file to read',
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
				} else if (operation === 'cleanEmptyDirectories') {
					const directoryPath = this.getNodeParameter('directoryPath', i) as string;
					const recursive = this.getNodeParameter('recursive', i) as boolean;
					
					await cleanEmptyDirectories(directoryPath, recursive);
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
								? `成功修复了 ${successCount} 个文件名` 
								: `修复了 ${successCount} 个文件名，但有 ${failedResults.length} 个失败`,
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
					const returnAsArray = this.getNodeParameter('returnAsArray', i) as boolean;

					const result = await deleteFiles({
						dirPath: directoryPath,
						pattern,
						recursive,
						includeFiles,
						includeDirectories,
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
					
					const results = await flattenDirectory(directoryPath);
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
				} else if (operation === 'readFile') {
					const filePath = this.getNodeParameter('filePath', i) as string;
					const result = await readFile({ filePath });
					returnData.push({
						json: result,
					});
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