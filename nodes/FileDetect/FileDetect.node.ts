import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeParameters,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { configuredOutputs } from './config';
import {
	checkFileExists,
	checkFileExtension,
	checkFileType,
	checkTextContent,
	checkPermissions,
} from './utils';

export class FileDetect implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'File Detect',
		name: 'fileDetect',
		icon: 'file:FileDetect.svg',
		group: ['transform'],
		version: 2,
		subtitle: 'Route by file detection',
		description: 'Detect file properties and route based on conditions',
		defaults: {
			name: 'File Detect',
			color: '#00aaff',
		},
		inputs: ['main'],
		outputs: ['true', 'false'],
		outputNames: ['true', 'false'],
		properties: [
			
			{
				displayName: 'File Path',
				name: 'filePath',
				type: 'string',
				default: '',
				required: true,
				description: 'Path to the file to detect',
				placeholder: '/path/to/file.txt',
			},
			{
				displayName: 'Check File Exists',
				name: 'checkExists',
				type: 'boolean',
				default: false,
				description: 'Check if the file exists',
			},
			{
				displayName: 'Check File Extension',
				name: 'checkExtension',
				type: 'boolean',
				default: false,
				description: 'Check if file extension matches specified extensions',
			},
			{
				displayName: 'Allowed Extensions',
				name: 'allowedExtensions',
				type: 'string',
				default: '',
				description: 'Comma-separated list of allowed extensions (e.g., .txt,.pdf,.jpg)',
				placeholder: '.txt,.pdf,.jpg',
				displayOptions: {
					show: {
						checkExtension: [true],
					},
				},
			},
			{
				displayName: 'Check File Type',
				name: 'checkFileType',
				type: 'boolean',
				default: false,
				description: 'Check file type based on file header/magic bytes',
			},
			{
				displayName: 'Expected File Types',
				name: 'expectedFileTypes',
				type: 'multiOptions',
				default: ['text'],
				options: [
					{ name: 'Video', value: 'video' },
					{ name: 'Image', value: 'image' },
					{ name: 'JSON', value: 'json' },
					{ name: 'Text', value: 'text' },
					{ name: 'Binary', value: 'binary' },
				],
				description: 'Select expected file types (default: all types)',
				displayOptions: {
					show: {
						checkFileType: [true],
					},
				},
			},
			{
				displayName: 'Check Text Content',
				name: 'checkTextContent',
				type: 'boolean',
				default: false,
				description: 'Check if text file contains specified content',
			},
				{
					displayName: 'Search Text',
					name: 'searchText',
					type: 'string',
					default: '',
					description: 'Text to search for in the file',
					placeholder: 'Search text...',
					displayOptions: {
						show: {
							checkTextContent: [true],
						},
					},
				},
				{
					displayName: 'Use Regex',
					name: 'useRegex',
					type: 'boolean',
					default: false,
					description: 'Use regular expression for text matching',
					displayOptions: {
						show: {
							checkTextContent: [true],
						},
					},
				},
			{
				displayName: 'Check File Permissions',
				name: 'checkFilePermissions',
				type: 'boolean',
				default: false,
				description: 'Check if file has specific permissions',
			},
			{
				displayName: 'Required Permissions',
				name: 'checkPermissions',
				type: 'multiOptions',
				default: ['read'],
				options: [
					{ name: 'Read', value: 'read' },
					{ name: 'Write', value: 'write' },
					{ name: 'Execute', value: 'execute' },
				],
				description: 'Select permissions to check for',
				displayOptions: {
					show: {
						checkFilePermissions: [true],
					},
				},
			},
			{
				displayName: 'Logic Operation',
				name: 'logicOperation',
				type: 'options',
				default: 'and',
				options: [
					{ name: 'AND (All conditions must be true)', value: 'and' },
					{ name: 'OR (Any condition can be true)', value: 'or' },
				],
				description: 'How to combine multiple conditions',
			},

		],
	};

	methods = {
		loadOptions: {
			async getFileTypeOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return [
					{ name: 'Video', value: 'video' },
					{ name: 'Image', value: 'image' },
					{ name: 'JSON', value: 'json' },
					{ name: 'Text', value: 'text' },
					{ name: 'Binary', value: 'binary' },
				];
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		
		// Initialize return data for true/false outputs
		const returnData: INodeExecutionData[][] = [];
		for (let i = 0; i < 2; i++) {
			returnData.push([]);
		}

		for (let i = 0; i < items.length; i++) {
			try {
				const item = items[i];
				const filePath = this.getNodeParameter('filePath', i) as string;

				if (!filePath) {
					throw new NodeOperationError(this.getNode(), 'File path is required');
				}

				const logicOperation = this.getNodeParameter('logicOperation', i) as string;
				const results: boolean[] = [];

				// Check file exists
				const checkExists = this.getNodeParameter('checkExists', i, false) as boolean;
				if (checkExists) {
					const exists = await checkFileExists(filePath);
					results.push(exists);
				}

				// Check file extension
				const checkExtension = this.getNodeParameter('checkExtension', i, false) as boolean;
				if (checkExtension) {
					const allowedExtensions = this.getNodeParameter('allowedExtensions', i, '') as string;
					if (allowedExtensions) {
						const extensionMatch = checkFileExtension(filePath, allowedExtensions);
						results.push(extensionMatch);
					}
				}

				// Check file type
				const checkFileTypeOption = this.getNodeParameter('checkFileType', i, false) as boolean;
				if (checkFileTypeOption) {
					const expectedTypes = this.getNodeParameter('expectedFileTypes', i, ['video', 'image', 'json', 'text', 'binary']) as string[];
					if (expectedTypes.length > 0) {
						const typeMatch = await checkFileType(filePath, expectedTypes);
						results.push(typeMatch);
					}
				}

				// Check text content
				const checkTextContentOption = this.getNodeParameter('checkTextContent', i, false) as boolean;
				if (checkTextContentOption) {
					const searchText = this.getNodeParameter('searchText', i, '') as string;
					if (searchText) {
						const useRegex = this.getNodeParameter('useRegex', i, false) as boolean;
						const contentMatch = await checkTextContent(
							filePath,
							searchText,
							useRegex
						);
						results.push(contentMatch);
					}
				}

				// Check permissions
				const checkFilePermissionsOption = this.getNodeParameter('checkFilePermissions', i, false) as boolean;
				if (checkFilePermissionsOption) {
					const permissionsToCheck = this.getNodeParameter('checkPermissions', i, []) as string[];
					if (permissionsToCheck.length > 0) {
						const permissionMatch = await checkPermissions(filePath, permissionsToCheck);
						results.push(permissionMatch);
					}
				}

				// Evaluate results based on logic operation
				let finalResult = false;
				if (results.length > 0) {
					if (logicOperation === 'and') {
						finalResult = results.every(result => result);
					} else {
						finalResult = results.some(result => result);
					}
				}

				// Add result data
				const resultData = {
					...item.json,
					fileDetectResult: {
						filePath,
						finalResult,
						conditionResults: results,
						logicOperation,
					},
				};

				// Route to True (0) or False (1) output
				const outputIndex = finalResult ? 0 : 1;
				returnData[outputIndex].push({ json: resultData, pairedItem: { item: i } });

			} catch (error) {
				if (this.continueOnFail()) {
					// Add error to the false output
					returnData[1].push({
						json: {
							...items[i].json,
							error: error.message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		// Ensure we return at least empty arrays for all outputs
		return returnData.map(data => data || []);
	}
}