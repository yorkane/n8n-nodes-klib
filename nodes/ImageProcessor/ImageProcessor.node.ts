import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { OperationFactory, processImageInput, ImageInputType } from './operations';

export class ImageProcessor implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Image Processor',
        name: 'imageProcessor',
        icon: 'file:ImageProcessor.svg',
        group: ['transform'],
        version: 1,
        description: 'Process images using sharp library',
        defaults: {
            name: 'Image Processor',
        },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                options: [
                    {
                        name: '转换格式',
                        value: 'convert',
                        description: '仅转换格式，不进行其他处理',
                    },
                    {
                        name: '读取图片信息和EXIF',
                        value: 'getImageInfo',
                        description: '读取图片的基本信息和EXIF元数据',
                    },
                    {
                        name: '调整大小',
                        value: 'resize',
                    },
                    {
                        name: '裁切',
                        value: 'crop',
                    },
                ],
                default: 'resize',
                description: '要执行的图像处理操作',
            },
            {
                displayName: '包含EXIF信息',
                name: 'includeExif',
                type: 'boolean',
                default: true,
                description: '是否在输出的metadata中包含EXIF信息和解析的编码方式',
                displayOptions: {
                    show: {
                        operation: [
                            'getImageInfo',
                        ],
                    },
                },
            },
            {
                displayName: 'EXIF编码格式',
                name: 'exifEncoding',
                type: 'options',
                options: [
                    {
                        name: 'UTF-8',
                        value: 'utf-8',
                        description: 'UTF-8编码',
                    },
                    {
                        name: 'ASCII',
                        value: 'ascii',
                        description: 'ASCII编码',
                    },
                    {
                        name: 'GB2312',
                        value: 'gb2312',
                        description: 'GB2312中文编码',
                    },
                    {
                        name: 'GBK',
                        value: 'gbk',
                        description: 'GBK中文编码',
                    },
                    {
                        name: 'Latin1',
                        value: 'latin1',
                        description: 'Latin1编码',
                    },
                    {
                        name: 'Hex',
                        value: 'hex',
                        description: '十六进制字符串',
                    },
                    {
                        name: 'Base64',
                        value: 'base64',
                        description: 'Base64编码',
                    },
                    {
                        name: '原始对象',
                        value: 'raw',
                        description: '保持原始对象格式',
                    },
                ],
                default: 'utf-8',
                description: '当EXIF数据为Buffer时使用的编码格式',
                displayOptions: {
                    show: {
                        operation: [
                            'getImageInfo',
                        ],
                        includeExif: [
                            true,
                        ],
                    },
                },
            },
            {
                displayName: '附加描述信息',
                name: 'additionalDescription',
                type: 'string',
                default: '',
                description: '为图像添加附加描述信息（类似于PNG的comments或EXIF的description）',
                placeholder: '输入图像描述信息...',
                displayOptions: {
                    show: {
                        operation: [
                            'convert',
                            'resize',
                            'crop',
                        ],
                        outputType: [
                            'file',
                            'binaryData',
                        ],
                    },
                },
            },
            {
                displayName: 'Input Type',
                name: 'inputType',
                type: 'options',
                options: [
                    {
                        name: 'File Path',
                        value: 'filePath',
                    },
                    {
                        name: 'Base64',
                        value: 'base64',
                    },
                    {
                        name: 'Binary Data',
                        value: 'binaryData',
                    },
                ],
                default: 'filePath',
                description: 'The type of input for the image',
            },
            {
                displayName: 'Source Path',
                name: 'sourcePath',
                type: 'string',
                default: '',
                required: true,
                description: 'The path of the source image file',
                displayOptions: {
                    show: {
                        inputType: [
                            'filePath',
                        ],
                    },
                },
            },
            {
                displayName: 'Base64 Image',
                name: 'base64Image',
                type: 'string',
                default: '',
                required: true,
                description: 'The base64 encoded image data',
                displayOptions: {
                    show: {
                        inputType: [
                            'base64',
                        ],
                    },
                },
            },
            {
                displayName: 'Binary Property',
                name: 'binaryProperty',
                type: 'string',
                default: 'data',
                required: true,
                description: 'The binary property containing the image data',
                displayOptions: {
                    show: {
                        inputType: [
                            'binaryData',
                        ],
                    },
                },
            },
            {
                displayName: 'Target Path',
                name: 'targetPath',
                type: 'string',
                default: '',
                required: true,
                description: 'The path where the processed image will be saved',
                displayOptions: {
                    show: {
                        operation: [
                            'resize',
                            'crop',
                            'convert',
                        ],
                        outputType: [
                            'file',
                        ],
                    },
                },
            },
            // 调整大小操作的参数
            {
                displayName: '调整大小模式',
                name: 'resizeMode',
                type: 'options',
                options: [
                    {
                        name: '指定宽高',
                        value: 'dimensions',
                        description: '指定图像的宽度和高度',
                    },
                    {
                        name: '按最长边缩放',
                        value: 'maxDimension',
                        description: '根据最长边的尺寸等比例缩放图像',
                    },
                ],
                default: 'dimensions',
                description: '调整大小的模式',
                displayOptions: {
                    show: {
                        operation: [
                            'resize',
                        ],
                    },
                },
            },
            {
                displayName: '分辨率',
                name: 'resolution',
                type: 'options',
                options: [
                    {
                        name: '自定义',
                        value: 'custom',
                        description: '手动输入分辨率（格式：宽x高）',
                    },
                    {
                        name: '1920x1080 (Full HD)',
                        value: '1920x1080',
                    },
                    {
                        name: '2560x1440 (2K)',
                        value: '2560x1440',
                    },
                    {
                        name: '3840x2160 (4K)',
                        value: '3840x2160',
                    },
                    {
                        name: '1280x720 (HD)',
                        value: '1280x720',
                    },
                    {
                        name: '1536x640',
                        value: '1536x640',
                    },
                    {
                        name: '1024x576',
                        value: '1024x576',
                    },
                    {
                        name: '800x600',
                        value: '800x600',
                    },
                    {
                        name: '1080x1920 (竖屏Full HD)',
                        value: '1080x1920',
                    },
                    {
                        name: '1440x2560 (竖屏2K)',
                        value: '1440x2560',
                    },
                    {
                        name: '720x1280 (竖屏HD)',
                        value: '720x1280',
                    },
                    {
                        name: '640x1536',
                        value: '640x1536',
                    },
                ],
                default: '800x600',
                description: '输出图像的分辨率',
                displayOptions: {
                    show: {
                        operation: [
                            'resize',
                        ],
                        resizeMode: [
                            'dimensions',
                        ],
                    },
                },
            },
            {
                displayName: '自定义分辨率',
                name: 'customResolution',
                type: 'string',
                default: '800x600',
                description: '手动输入分辨率，格式：宽x高（例如：1920x1080）',
                placeholder: '1920x1080',
                displayOptions: {
                    show: {
                        operation: [
                            'resize',
                        ],
                        resizeMode: [
                            'dimensions',
                        ],
                        resolution: [
                            'custom',
                        ],
                    },
                },
            },
            {
                displayName: '最长边尺寸',
                name: 'maxDimension',
                type: 'number',
                default: 800,
                description: '图像最长边的尺寸，将按比例缩放',
                displayOptions: {
                    show: {
                        operation: [
                            'resize',
                        ],
                        resizeMode: [
                            'maxDimension',
                        ],
                    },
                },
            },
            {
                displayName: '调整大小选项',
                name: 'resizeOptions',
                type: 'collection',
                placeholder: '添加选项',
                default: {},
                options: [
                    {
                        displayName: '缩放模式',
                        name: 'fit',
                        type: 'options',
                        options: [
                            {
                                name: '包含 (contain)',
                                value: 'contain',
                                description: '保持纵横比，调整大小以适应指定的尺寸',
                            },
                            {
                                name: '覆盖 (cover)',
                                value: 'cover',
                                description: '保持纵横比，调整大小以填充指定的尺寸，可能会裁剪图像',
                            },
                            {
                                name: '填充 (fill)',
                                value: 'fill',
                                description: '忽略纵横比，调整大小以填充指定的尺寸',
                            },
                            {
                                name: '内部 (inside)',
                                value: 'inside',
                                description: '保持纵横比，调整大小以适应指定的尺寸，不会超过指定的尺寸',
                            },
                            {
                                name: '外部 (outside)',
                                value: 'outside',
                                description: '保持纵横比，调整大小以填充指定的尺寸，不会小于指定的尺寸',
                            },
                        ],
                        default: 'contain',
                        description: '调整大小时如何处理纵横比',
                    },
                    {
                        displayName: '背景颜色',
                        name: 'background',
                        type: 'string',
                        default: '#ffffff',
                        description: '背景颜色，例如 #ffffff 或 rgba(255,255,255,1)',
                    },
                    {
                        displayName: '位置',
                        name: 'position',
                        type: 'options',
                        options: [
                            { name: '上', value: 'top' },
                            { name: '右', value: 'right' },
                            { name: '下', value: 'bottom' },
                            { name: '左', value: 'left' },
                            { name: '中心', value: 'center' },
                        ],
                        default: 'center',
                        description: '图像在调整大小时的位置',
                    },
                    {
                        displayName: '不放大',
                        name: 'withoutEnlargement',
                        type: 'boolean',
                        default: false,
                        description: '如果图像尺寸已经小于目标尺寸，则不放大',
                    },
                    {
                        displayName: '不缩小',
                        name: 'withoutReduction',
                        type: 'boolean',
                        default: false,
                        description: '如果图像尺寸已经大于目标尺寸，则不缩小',
                    },
                ],
                displayOptions: {
                    show: {
                        operation: [
                            'resize',
                        ],
                    },
                },
            },
            // 裁切操作的参数
            {
                displayName: '裁切起始X坐标',
                name: 'cropX',
                type: 'number',
                default: 0,
                description: '裁切区域的起始X坐标',
                displayOptions: {
                    show: {
                        operation: [
                            'crop',
                        ],
                    },
                },
            },
            {
                displayName: '裁切起始Y坐标',
                name: 'cropY',
                type: 'number',
                default: 0,
                description: '裁切区域的起始Y坐标',
                displayOptions: {
                    show: {
                        operation: [
                            'crop',
                        ],
                    },
                },
            },
            {
                displayName: '裁切宽度',
                name: 'cropWidth',
                type: 'number',
                default: 300,
                description: '裁切区域的宽度',
                displayOptions: {
                    show: {
                        operation: [
                            'crop',
                        ],
                    },
                },
            },
            {
                displayName: '裁切高度',
                name: 'cropHeight',
                type: 'number',
                default: 300,
                description: '裁切区域的高度',
                displayOptions: {
                    show: {
                        operation: [
                            'crop',
                        ],
                    },
                },
            },
            // 输出格式参数
            {
                displayName: 'Format',
                name: 'format',
                type: 'options',
                options: [
                    {
                        name: 'JPEG',
                        value: 'jpeg',
                    },
                    {
                        name: 'PNG',
                        value: 'png',
                    },
                    {
                        name: 'WebP',
                        value: 'webp',
                    },
                    {
                        name: 'WebP 无损压缩',
                        value: 'webp-lossless',
                    },
                    {
                        name: 'AVIF',
                        value: 'avif',
                    },
                    {
                        name: 'TIFF',
                        value: 'tiff',
                    },
                    {
                        name: '与源文件相同',
                        value: 'same',
                    },
                ],
                default: 'jpeg',
                description: 'The format of the output image',
            },
            {
                displayName: '输出类型',
                name: 'outputType',
                type: 'options',
                options: [
                    {
                        name: '保存到文件',
                        value: 'file',
                        description: '将处理后的图片保存到指定文件路径',
                    },
                    {
                        name: '输出为Binary Data',
                        value: 'binaryData',
                        description: '将处理后的图片作为Binary Data输出',
                    },
                ],
                default: 'file',
                description: '选择输出方式：保存到文件或输出为Binary Data',
                displayOptions: {
                    show: {
                        operation: [
                            'convert',
                            'resize',
                            'crop',
                        ],
                    },
                },
            },
            {
                displayName: 'Quality',
                name: 'quality',
                type: 'number',
                default: 90,
                description: 'The quality of the output image (1-100)',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const operation = this.getNodeParameter('operation', i) as string;
                const inputType = this.getNodeParameter('inputType', i) as string;
                
                // 处理图像输入
                const inputData = await processImageInput(this, i);
                
                // 使用操作工厂创建并执行操作
                const operationInstance = OperationFactory.createOperation(operation);
                const result = await operationInstance.execute(this, inputData, i);
                returnData.push(result);
            } catch (error) {
                if (this.continueOnFail()) {
                    const operation = this.getNodeParameter('operation', i) as string;
                    returnData.push({
                        json: {
                            error: error instanceof Error ? error.message : String(error),
                            success: false,
                            operation,
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