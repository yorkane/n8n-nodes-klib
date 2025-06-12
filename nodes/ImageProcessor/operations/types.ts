import { Sharp } from 'sharp';
import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

// 图像输入类型
export type ImageInputType = 'filePath' | 'base64' | 'binaryData';

// 输出类型
export type OutputType = 'file' | 'binaryData';

// 图像输入数据
export interface ImageInputData {
    imageProcess: Sharp;
    sourceFormat: string;
    sourcePath?: string;
    metadata?: any;
}

// 操作结果
export interface OperationResult extends INodeExecutionData {
    json: Record<string, any>;
    binary?: Record<string, any>;
}

// 操作基类接口
export interface IImageOperation {
    execute(
        context: IExecuteFunctions,
        inputData: ImageInputData,
        itemIndex: number
    ): Promise<OperationResult>;
}

// 通用参数
export interface CommonParams {
    inputType: ImageInputType;
    format?: string;
    quality?: number;
    outputType?: OutputType;
    targetPath?: string;
}