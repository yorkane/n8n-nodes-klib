import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { TfIdf, Jieba } from '@node-rs/jieba';
import { dict, idf } from '@node-rs/jieba/dict'

export class JiebaSegment implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Jieba',
		name: 'jieba',
		icon: 'file:jieba.svg',
		group: ['transform'],
		version: 1,
		description: '使用jieba进行中文分词',
		defaults: {
			name: 'Jieba',
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
						name: 'Precise cut Mode',
						value: 'cut',
						description: 'Precise mode segmentation',
					},
					{
						name: 'cutAll Mode',
						value: 'cutAll',
						description: 'Full mode segmentation',
					},
					{
						name: 'cutForSearch Mode',
						value: 'cutForSearch',
						description: '方法接受两个参数：需要分词的字符串；是否使用 HMM 模型。该方法适合用于搜索引擎构建倒排索引的分词，粒度比较细',
					},
					{
						name: 'Part of Speech Tagging',
						value: 'tag',
						description: 'Part of speech tagging',
					},
					{
						name: 'TF-IDF Keywords/Tags',
						value: 'tfidf',
						description: 'Extract keywords/Tags using TF-IDF',
					},
				],
				default: 'cut',
			},
			{
				displayName: 'Input Text',
				name: 'text',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['cut', 'cutAll', 'cutForSearch', 'tag', 'tfidf'],
					},
				},
			},
			{
				displayName: 'HMM model, Allow New Words',
				name: 'HMM',
				type: 'boolean',
				default: true,
				description: 'Allow HMM to create new words',
				displayOptions: {
					show: {
						operation: ['cut', 'tag', 'cutForSearch'],
					},
				},
			},
			{
				displayName: 'Top K Results',
				name: 'topK',
				type: 'number',
				default: 10,
				description: 'Number of top keywords to extract ',
				displayOptions: {
					show: {
						operation: ['tfidf'],
					},
				},
			},
			{
				displayName: 'Min Keyword Length',
				name: 'minKeywordLength',
				type: 'number',
				default: 2,
				description: 'Minimum keyword length',
				displayOptions: {
					show: {
						operation: ['tfidf'],
					},
				},
			},
			{
				displayName: 'Custom Dictionary',
				name: 'customDict',
				type: 'string',
				default: '',
				description: `Custom dictionary content (UTF-8 encoding) 
一个词占一行；每一行分三部分：词语、词频（可省略）、词性（可省略），用空格隔开，顺序不可颠倒：
创新办 3 i
云计算 5
凱特琳 nz
台中`,
				typeOptions: {
					rows: 4,
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		

		for (let i = 0; i < items.length; i++) {
			// UI可能没有出现，所以需要判断
			const operation = this.getNodeParameter('operation', i) as string;
			const text = this.getNodeParameter('text', i) as string;
			
			let jieba: Jieba;
			const customDict = this.getNodeParameter('customDict', i) as string;
			if (customDict && customDict.trim().length > 4) {
				jieba = Jieba.withDict(Uint8Array.from(Buffer.from(customDict, 'utf-8')));
			} else {
				jieba = Jieba.withDict(dict);
			}

			let result: any;
			switch (operation) {
				case 'cut':
					const cutHMM = this.getNodeParameter('HMM', i, true) as boolean;
					result = jieba.cut(text, cutHMM);
					break;
				case 'cutAll':
					result = jieba.cutAll(text);
					break;
				case 'cutForSearch':
					const searchHMM = this.getNodeParameter('HMM', i, true) as boolean;
					result = jieba.cutForSearch(text, searchHMM);
					break;
				case 'tag':
					const tagHMM = this.getNodeParameter('HMM', i, true) as boolean;
					result = jieba.tag(text, tagHMM);
					break;
				case 'tfidf':
					const topK = this.getNodeParameter('topK', i, 10) as number;
					const minKeywordLength = this.getNodeParameter('minKeywordLength', i, 10) as number;
					let tfidf = TfIdf.withDict(idf);
					tfidf.setConfig({
						minKeywordLength: minKeywordLength,
					});
					result = tfidf.extractKeywords(jieba, text, topK);
					break;
				default:
					throw new Error(`未知的操作类型: ${operation}`);
			}

			returnData.push({
				json: {
					result,
				},
			});
		}

		return [returnData];
	}
} 