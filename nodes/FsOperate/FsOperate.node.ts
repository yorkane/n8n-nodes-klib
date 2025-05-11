import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { cleanEmptyDirectories } from './openrations/cleanEmptyDirectories';
import { fixFileNames } from './openrations/fixFileNames';
import { deleteFiles, COMMON_FILE_EXTENSIONS } from './openrations/deleteFiles';
import { moveFiles } from './openrations/moveFiles';
import { flattenDirectory } from './openrations/flattenDirectory';
import { rename } from './openrations/rename';
import { DEFAULT_PROTECTION_CONFIG, MIN_DIRECTORY_DEPTH, MAX_DIRECTORY_DEPTH } from './openrations/directoryProtection';

export class FsOperate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FileOperate',
		name: 'fsOperate',
		icon: 'file:FsUtils.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'File system operations for files and directories',
		defaults: {
			name: 'File System Operate',
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
						name: 'Rename',
						value: 'rename',
						description: 'Rename files or directories with pattern matching',
					},
				],
				default: 'cleanEmptyDirectories',
			},
			{
				displayName: 'Directory Path',
				name: 'directoryPath',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['cleanEmptyDirectories', 'fixFileNames', 'deleteFiles', 'flattenDirectory'],
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
				displayName: 'Source Path',
				name: 'sourcePath',
				type: 'string',
				default: '',
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
				required: true,
				displayOptions: {
					show: {
						operation: ['rename'],
					},
				},
			},
			{
				displayName: 'Pattern',
				name: 'pattern',
				type: 'string',
				default: '',
				description: 'Regular expression to match Target Path above',
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
				description: 'Replace Target Path above with matched pattern',
				required: false,
				displayOptions: {
					show: {
						operation: ['rename'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'cleanEmptyDirectories') {
					const directoryPath = this.getNodeParameter('directoryPath', i) as string;
					const recursive = this.getNodeParameter('recursive', i) as boolean;
					await cleanEmptyDirectories(directoryPath, recursive);
					returnData.push({ ...items[i].json, success: true });
				} else if (operation === 'fixFileNames') {
					const directoryPath = this.getNodeParameter('directoryPath', i) as string;
					const recursive = this.getNodeParameter('recursive', i) as boolean;
					const onlyDirectories = this.getNodeParameter('onlyDirectories', i) as boolean;
					const result = await fixFileNames(directoryPath, recursive, onlyDirectories);
					returnData.push({ ...items[i].json, result });
				} else if (operation === 'deleteFiles') {
					const directoryPath = this.getNodeParameter('directoryPath', i) as string;
					const pattern = this.getNodeParameter('pattern', i) as string;
					const recursive = this.getNodeParameter('recursive', i) as boolean;
					const includeFiles = this.getNodeParameter('includeFiles', i) as boolean;
					const includeDirectories = this.getNodeParameter('includeDirectories', i) as boolean;
					const deleteRootDir = this.getNodeParameter('deleteRootDir', i) as boolean;
					const useShell = this.getNodeParameter('useShell', i) as boolean;
					const fileExtensions = this.getNodeParameter('fileExtensions', i) as string[];
					const customExtensions = this.getNodeParameter('customExtensions', i) as string;
					const result = await deleteFiles({
						dirPath: directoryPath,
						pattern,
						recursive,
						includeFiles,
						includeDirectories,
						deleteRootDir,
						useShell,
						fileExtensions: [...(fileExtensions || []), ...(customExtensions ? customExtensions.split(',').map(ext => ext.trim()) : [])],
					});
					returnData.push({ ...items[i].json, result });
				} else if (operation === 'moveFiles') {
					const sourceDir = this.getNodeParameter('sourceDir', i) as string;
					const targetDir = this.getNodeParameter('targetDir', i) as string;
					const pattern = this.getNodeParameter('pattern', i) as string;
					const recursive = this.getNodeParameter('recursive', i) as boolean;
					const includeFiles = this.getNodeParameter('includeFiles', i) as boolean;
					const includeDirectories = this.getNodeParameter('includeDirectories', i) as boolean;
					const renameOnly = this.getNodeParameter('renameOnly', i) as boolean;
					const result = await moveFiles({
						sourcePath: sourceDir,
						targetDir,
						pattern,
						recursive,
						includeFiles,
						includeDirectories,
						renameOnly,
					});
					returnData.push({ ...items[i].json, result });
				} else if (operation === 'flattenDirectory') {
					const directoryPath = this.getNodeParameter('directoryPath', i) as string;
					const result = await flattenDirectory(directoryPath);
					returnData.push({ ...items[i].json, result });
				} else if (operation === 'rename') {
					const sourcePath = this.getNodeParameter('sourcePath', i) as string;
					const targetPath = this.getNodeParameter('targetPath', i) as string;
					const pattern = this.getNodeParameter('pattern', i) as string;
					const replacement = this.getNodeParameter('replacement', i) as string;
					const result = await rename({
						sourcePath,
						targetPath,
						pattern,
						replacement,
					});
					if (result.renamed) {
						const path = require('path');
						const newPath = result.renamed;
						const newName = path.basename(newPath);
						const newParent = path.dirname(newPath);
						
						returnData.push({ 
							...items[i].json, 
							beforeRename: sourcePath,
							path: newPath,
							parent: newParent,
							name: newName
						});
					} else {
						returnData.push({ ...items[i].json });
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ ...items[i].json, error: error.message });
					continue;
				}
				throw error;
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
} 