import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { listDirectory } from './operations/listDirectory';
import { readFile } from './operations/readFile';
import { findFiles } from './operations/findFiles';

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
						name: 'Find Files',
						value: 'findFiles',
						description: 'Use system find command to search files',
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
						operation: ['listDirectory', 'findFiles'],
					},
				},
			},
			{
				displayName: 'File Extensions',
				name: 'fileExtensions',
				type: 'multiOptions',
				options: [
					{
						name: 'Images (*.jpg,*.png,*.gif)',
						value: '.jpg,.png,.gif',
					},
					{
						name: 'Documents (*.pdf,*.doc,*.docx)',
						value: '.pdf,.doc,.docx',
					},
					{
						name: 'Archives (*.zip,*.rar,*.7z)',
						value: '.zip,.rar,.7z',
					},
					{
						name: 'Videos (*.mp4,*.avi,*.mkv)',
						value: '.mp4,.avi,.mkv',
					},
				],
				default: [],
				description: 'Select file extensions to filter (can be combined with custom extensions)',
				displayOptions: {
					show: {
						operation: ['findFiles'],
					},
				},
			},
			{
				displayName: 'Custom File Extensions',
				name: 'customFileExtensions',
				type: 'string',
				default: '',
				description: 'Additional comma-separated file extensions (e.g. .txt,.pdf,.doc)',
				displayOptions: {
					show: {
						operation: ['findFiles'],
					},
				},
			},
			{
				displayName: 'Show',
				name: 'showType',
				type: 'options',
				options: [
					{
						name: 'Files and Directories',
						value: 'both',
					},
					{
						name: 'Files Only',
						value: 'files',
					},
					{
						name: 'Directories Only',
						value: 'directories',
					},
				],
				default: 'both',
				displayOptions: {
					show: {
						operation: ['listDirectory', 'findFiles'],
					},
				},
			},
			{
				displayName: 'Max Depth',
				name: 'maxDepth',
				type: 'number',
				default: 1,
				description: 'Maximum directory depth to traverse (1-9)',
				typeOptions: {
					minValue: 1,
					maxValue: 9,
				},
				displayOptions: {
					show: {
						operation: ['listDirectory', 'findFiles'],
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
						operation: ['listDirectory', 'findFiles'],
					},
				},
			},
			{
				displayName: 'Sort Direction',
				name: 'sortDirection',
				type: 'options',
				options: [
					{
						name: 'Ascending',
						value: 'asc',
					},
					{
						name: 'Descending',
						value: 'desc',
					},
				],
				default: 'asc',
				displayOptions: {
					show: {
						operation: ['listDirectory', 'findFiles'],
					},
				},
			},
			{
				displayName: 'Filter Pattern',
				name: 'filter',
				type: 'string',
				default: '',
				description: 'Regular expression pattern find files/directories',
				displayOptions: {
					show: {
						operation: ['listDirectory', 'findFiles'],
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
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				options: [
					{
						name: 'Auto Detect',
						value: 'auto',
					},
					{
						name: 'Base64',
						value: 'base64',
					},
					{
						name: 'Binary',
						value: 'binary',
					},
				],
				default: 'auto',
				displayOptions: {
					show: {
						operation: ['readFile'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		
		try {
			const operation = this.getNodeParameter('operation', 0) as string;
			if (!operation) {
				throw new Error('Operation parameter is required');
			}

			for (let i = 0; i < items.length; i++) {
				try {
					if (operation === 'listDirectory') {
						const directoryPath = this.getNodeParameter('directoryPath', i) as string;
						if (!directoryPath) {
							throw new Error('Directory path is required');
						}

						const showType = this.getNodeParameter('showType', i) as string;
						const showFiles = showType === 'both' || showType === 'files';
						const showDirectories = showType === 'both' || showType === 'directories';
						const maxDepth = this.getNodeParameter('maxDepth', i) as number ?? 1;
						const sortBy = this.getNodeParameter('sortBy', i) as string ?? 'name';
						const sortDirection = this.getNodeParameter('sortDirection', i) as string ?? 'asc';
						const filter = this.getNodeParameter('filter', i) as string || '';

						const result = await listDirectory({
							dirPath: directoryPath,
							showFiles,
							showDirectories,
							maxDepth,
							sortBy,
							sortDirection: sortDirection as 'asc' | 'desc',
							filter,
						});
						returnData.push(...result);
					} else if (operation === 'findFiles') {
						const directoryPath = this.getNodeParameter('directoryPath', i) as string;
						if (!directoryPath) {
							throw new Error('Directory path is required');
						}

						const selectedExtensions = this.getNodeParameter('fileExtensions', i) as string[] || [];
						const customExtensions = this.getNodeParameter('customFileExtensions', i) as string || '';
						
						// 合并预设和自定义扩展名
						const fileExtensions = [
							...(Array.isArray(selectedExtensions) ? selectedExtensions : []),
							...(customExtensions ? customExtensions.split(',').map(ext => ext.trim()).filter(ext => ext) : [])
						].join(',');

						const showType = this.getNodeParameter('showType', i) as string;
						const showFiles = showType === 'both' || showType === 'files';
						const showDirectories = showType === 'both' || showType === 'directories';
						const maxDepth = this.getNodeParameter('maxDepth', i) as number ?? 1;
						const sortBy = this.getNodeParameter('sortBy', i) as string ?? 'name';
						const sortDirection = this.getNodeParameter('sortDirection', i) as string ?? 'asc';
						const filter = this.getNodeParameter('filter', i) as string || '';

						const result = await findFiles({
							dirPath: directoryPath,
							fileExtensions,
							showFiles,
							showDirectories,
							maxDepth,
							filter,
						});

						// 排序
						result.sort((a, b) => {
							let comparison = 0;
							switch (sortBy) {
								case 'name':
									comparison = a.name.localeCompare(b.name);
									break;
								case 'mtime':
									comparison = b.mtime.getTime() - a.mtime.getTime();
									break;
								case 'type':
									comparison = a.type.localeCompare(b.type);
									break;
								default:
									return 0;
							}
							return sortDirection === 'asc' ? comparison : -comparison;
						});

						returnData.push(...result);
					} else if (operation === 'readFile') {
						const filePath = this.getNodeParameter('filePath', i) as string;
						if (!filePath) {
							throw new Error('File path is required');
						}
						
						const outputFormat = this.getNodeParameter('outputFormat', i) as string || 'auto';
						const result = await readFile({
							filePath,
							outputFormat: outputFormat as 'auto' | 'base64' | 'binary',
						});
						returnData.push(result);
					} else {
						throw new Error(`Unsupported operation: ${operation}`);
					}
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({ 
							...items[i].json, 
							error: error.message || 'Unknown error occurred',
							operation,
							timestamp: new Date().toISOString()
						});
						continue;
					}
					throw error;
				}
			}
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({ 
					error: error.message || 'Unknown error occurred',
					timestamp: new Date().toISOString()
				});
			} else {
				throw error;
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
} 