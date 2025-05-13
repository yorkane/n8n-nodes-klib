import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IBinaryData,
} from 'n8n-workflow';
import { listDirectory } from './operations/listDirectory';
import { readFile } from './operations/readFile';
import { findFiles } from './operations/findFiles';
import { writeFile } from './operations/writeFile';
import { searchContent } from './operations/searchContent';

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
					{
						name: 'Write File',
						value: 'writeFile',
						description: 'Write content to a file',
					},
					{
						name: 'Search Content',
						value: 'searchContent',
						description: 'Search for content in a file using grep',
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
						name: 'Images (jpg,png,gif,bmp,webp,svg)',
						value: '.jpg,.png,.gif,.bmp,.webp,.jpeg,svg',
					},
					{
						name: 'Documents (pdf,doc,docx,xls,xlsx,ppt,pptx)',
						value: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx',
					},
					{
						name: 'Archives (zip,rar,7z,tar,gz,bz2,xz)',
						value: '.zip,.rar,.7z,.tar,.gz,.bz2,.xz',
					},
					{
						name: 'Videos (mp4,avi,mkv,mov,flv,wmv,webm)',
						value: '.mp4,.avi,.mkv,.mov,.flv,.wmv,.webm',
					},
					{
						name: 'Audio (mp3,wav,ogg,m4a,aac,flac,wma)',
						value: '.mp3,.wav,.ogg,.m4a,.aac,.flac,.wma',
					},
					{
						name: 'Text (txt,log,md,csv,json,xml,yaml,html,htm,css,js)',
						value: '.txt,.log,.md,.csv,.json,.xml,.yaml,.html,.htm,.css,.js',
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
				default: 'files',
				displayOptions: {
					show: {
						operation: ['listDirectory', 'findFiles'],
					},
				},
			},
			{
				displayName: 'Only Leaf Folders',
				name: 'onlyLeafFolders',
				type: 'boolean',
				default: false,
				description: '如果选中，则只返回没有子目录的目录',
				displayOptions: {
					show: {
						operation: ['listDirectory', 'findFiles'],
						showType: ['directories', 'both'],
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
					{
						name: 'Size',
						value: 'size',
					},
					{
						name: 'Depth',
						value: 'depth',
					},
					{
						name: 'Full Path',
						value: 'path',
					},
					{
						name: 'Parent Directory',
						value: 'parent',
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
				description: '文件路径，每行一个路径',
				typeOptions: {
					rows: 4,
				},
				displayOptions: {
					show: {
						operation: ['readFile', 'writeFile', 'searchContent'],
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
						name: 'String',
						value: 'string',
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
			{
				displayName: 'Digest Algorithm',
				name: 'digestAlgorithm',
				type: 'options',
				options: [
					{
						name: 'None',
						value: 'none',
					},
					{
						name: 'XXHash64',
						value: 'xxhash64',
					},
					{
						name: 'MD5',
						value: 'md5',
					},
					{
						name: 'SHA1',
						value: 'sha1',
					},
					{
						name: 'SHA256',
						value: 'sha256',
					},
					{
						name: 'SHA512',
						value: 'sha512',
					},
				],
				default: 'none',
				displayOptions: {
					show: {
						operation: ['readFile'],
					},
				},
			},
			{
				displayName: 'Salt',
				name: 'salt',
				type: 'string',
				default: '',
				description: '可选的salt值，用于增加摘要的安全性',
				displayOptions: {
					show: {
						operation: ['readFile'],
						digestAlgorithm: ['md5', 'sha1', 'sha256', 'sha512'],
					},
				},
			},
			{
				displayName: 'Only Output Digest',
				name: 'onlyOutputDigest',
				type: 'boolean',
				default: false,
				description: '如果选中，则只输出摘要而不输出内容',
				displayOptions: {
					show: {
						operation: ['readFile'],
						digestAlgorithm: ['md5', 'sha1', 'sha256', 'sha512'],
					},
				},
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				default: '',
				required: true,
				description: '要写入文件的内容',
				typeOptions: {
					rows: 5,
				},
				displayOptions: {
					show: {
						operation: ['writeFile'],
						contentType: ['text'],
					},
				},
			},
			{
				displayName: 'Content Type',
				name: 'contentType',
				type: 'options',
				options: [
					{
						name: 'Text',
						value: 'text',
					},
					{
						name: 'Binary',
						value: 'binary',
					},
				],
				default: 'text',
				description: '内容类型',
				displayOptions: {
					show: {
						operation: ['writeFile'],
					},
				},
			},
			{
				displayName: 'Binary Property',
				name: 'binaryProperty',
				type: 'string',
				default: 'data',
				required: true,
				description: '包含二进制数据的属性名称',
				displayOptions: {
					show: {
						operation: ['writeFile'],
						contentType: ['binary'],
					},
				},
			},
			{
				displayName: 'Encoding',
				name: 'encoding',
				type: 'options',
				options: [
					{
						name: 'UTF-8',
						value: 'utf8',
					},
					{
						name: 'ASCII',
						value: 'ascii',
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
				default: 'utf8',
				description: '文件编码格式',
				displayOptions: {
					show: {
						operation: ['writeFile'],
						contentType: ['text'],
					},
				},
			},
			{
				displayName: 'Append',
				name: 'append',
				type: 'boolean',
				default: false,
				description: '是否追加到文件末尾',
				displayOptions: {
					show: {
						operation: ['writeFile'],
					},
				},
			},
			{
				displayName: 'Create Directory',
				name: 'createDirectory',
				type: 'boolean',
				default: false,
				description: '如果目录不存在，是否自动创建',
				displayOptions: {
					show: {
						operation: ['writeFile'],
					},
				},
			},
			{
				displayName: 'Search Pattern',
				name: 'searchPattern',
				type: 'string',
				default: '',
				required: true,
				description: 'The text or regex pattern to search for',
				displayOptions: {
					show: {
						operation: ['searchContent'],
					},
				},
			},
			{
				displayName: 'Use Regular Expression',
				name: 'isRegex',
				type: 'boolean',
				default: false,
				description: 'Whether to treat the search pattern as a regular expression',
				displayOptions: {
					show: {
						operation: ['searchContent'],
					},
				},
			},
			{
				displayName: 'Maximum Records',
				name: 'maxRecords',
				type: 'number',
				default: 10,
				description: '限制返回的最大记录数量，避免内存不足',
				typeOptions: {
					minValue: 1,
					maxValue: 5000,
				},
				displayOptions: {
					show: {
						operation: ['listDirectory', 'findFiles'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		
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
						const onlyLeafFolders = showDirectories ? this.getNodeParameter('onlyLeafFolders', i) as boolean || false : false;
						const maxRecords = this.getNodeParameter('maxRecords', i) as number ?? 100;

						const result = await listDirectory({
							dirPath: directoryPath,
							showFiles,
							showDirectories,
							maxDepth,
							sortBy,
							sortDirection: sortDirection as 'asc' | 'desc',
							filter,
							onlyLeafDirs: onlyLeafFolders,
							maxRecords,
						});
						
						// 将结果转换为 INodeExecutionData 格式
						result.forEach(item => {
							returnData.push({
								json: item
							});
						});
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
						const onlyLeafFolders = showDirectories ? this.getNodeParameter('onlyLeafFolders', i) as boolean || false : false;
						const maxRecords = this.getNodeParameter('maxRecords', i) as number ?? 100;

						const result = await findFiles({
							dirPath: directoryPath,
							fileExtensions,
							showFiles,
							showDirectories,
							maxDepth,
							filter,
							sortBy,
							sortDirection: sortDirection as 'asc' | 'desc',
							onlyLeafDirs: onlyLeafFolders,
							maxRecords,
						});

						// 将结果转换为 INodeExecutionData 格式
						result.forEach(item => {
							returnData.push({
								json: item
							});
						});
					} else if (operation === 'readFile') {
						const filePath = this.getNodeParameter('filePath', i) as string;
						if (!filePath) {
							throw new Error('File path is required');
						}
						
						const outputFormat = this.getNodeParameter('outputFormat', i) as string || 'auto';
						const digestAlgorithm = this.getNodeParameter('digestAlgorithm', i) as string || 'none';
						const salt = digestAlgorithm !== 'none' ? this.getNodeParameter('salt', i) as string || '' : '';
						const onlyOutputDigest = digestAlgorithm !== 'none' ? this.getNodeParameter('onlyOutputDigest', i) as boolean || false : false;
						
						const result = await readFile({
							filePath,
							outputFormat: outputFormat as 'auto' | 'base64' | 'binary' | 'string',
							digestAlgorithm: digestAlgorithm as 'none' | 'md5' | 'sha1' | 'sha256' | 'sha512',
							context: this,
							itemIndex: i,
							salt,
							onlyOutputDigest,
						});
						returnData.push(result);
					} else if (operation === 'writeFile') {
						const filePath = this.getNodeParameter('filePath', i) as string;
						if (!filePath) {
							throw new Error('File path is required');
						}

						const contentType = this.getNodeParameter('contentType', i) as string;
						let content: string | IBinaryData;
						
						if (contentType === 'binary') {
							const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
							const binaryData = items[i].binary?.[binaryProperty];
							if (!binaryData) {
								throw new Error(`未找到二进制数据属性: ${binaryProperty}`);
							}
							content = binaryData;
						} else {
							content = this.getNodeParameter('content', i) as string;
						}

						const encoding = this.getNodeParameter('encoding', i) as BufferEncoding;
						const append = this.getNodeParameter('append', i) as boolean;
						const createDirectory = this.getNodeParameter('createDirectory', i) as boolean;

						const result = await writeFile({
							filePath,
							content,
							encoding,
							append,
							createDirectory,
							context: this,
							itemIndex: i,
						});
						returnData.push(result);
					} else if (operation === 'searchContent') {
						const filePath = this.getNodeParameter('filePath', i) as string;
						const searchPattern = this.getNodeParameter('searchPattern', i) as string;
						const isRegex = this.getNodeParameter('isRegex', i) as boolean;

						const results = await searchContent.call(this, filePath, searchPattern, isRegex);
						
						// 只有当有搜索结果时才添加到返回数据中
						if (results.length > 0) {
							returnData.push({
								json: {
									results,
								},
							});
						}
					} else {
						throw new Error(`Unsupported operation: ${operation}`);
					}
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({ 
							json: { 
								error: error.message || 'Unknown error occurred',
								operation,
								timestamp: new Date().toISOString()
							}
						});
						continue;
					}
					throw error;
				}
			}
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({ 
					json: { 
						error: error.message || 'Unknown error occurred',
						timestamp: new Date().toISOString()
					}
				});
			} else {
				throw error;
			}
		}

		return [returnData];
	}
} 