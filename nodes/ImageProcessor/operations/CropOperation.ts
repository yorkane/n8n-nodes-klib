import { IExecuteFunctions } from 'n8n-workflow';
import { IImageOperation, ImageInputData, OperationResult, OutputType } from './types';
import {
    setOutputFormat,
    handleFileOutput,
    handleBinaryOutput,
    addSourceInfo,
    addImageMetadata
} from './utils';

export class CropOperation implements IImageOperation {
    async execute(
        context: IExecuteFunctions,
        inputData: ImageInputData,
        itemIndex: number
    ): Promise<OperationResult> {
        const { imageProcess, sourceFormat, sourcePath, metadata } = inputData;
        
        // 获取参数
        const outputType = context.getNodeParameter('outputType', itemIndex) as OutputType;
        const format = context.getNodeParameter('format', itemIndex) as string;
        const quality = context.getNodeParameter('quality', itemIndex) as number;
        const inputType = context.getNodeParameter('inputType', itemIndex) as string;
        const additionalDescription = context.getNodeParameter('additionalDescription', itemIndex) as string;
        
        // 获取裁切参数
        const cropX = context.getNodeParameter('cropX', itemIndex) as number;
        const cropY = context.getNodeParameter('cropY', itemIndex) as number;
        const cropWidth = context.getNodeParameter('cropWidth', itemIndex) as number;
        const cropHeight = context.getNodeParameter('cropHeight', itemIndex) as number;
        
        const cropInfo = {
            x: cropX,
            y: cropY,
            width: cropWidth,
            height: cropHeight
        };
        
        // 执行裁切操作
        const processedImage = imageProcess.extract({
            left: cropX,
            top: cropY,
            width: cropWidth,
            height: cropHeight
        });
        
        // 设置输出格式
        const { imageProcess: finalImage, outputFormat } = setOutputFormat(
            processedImage,
            format,
            sourceFormat,
            quality,
            additionalDescription
        );
        
        // 构建基础结果
        const resultJson: Record<string, any> = {
            operation: 'crop',
            format: outputFormat,
            quality,
            outputType,
            success: true,
            inputType,
            cropInfo
        };
        
        // 根据输出类型处理
        let binaryData: Record<string, any> | undefined;
        
        if (outputType === 'file') {
            const targetPath = context.getNodeParameter('targetPath', itemIndex) as string;
            const finalTargetPath = await handleFileOutput(
                finalImage,
                targetPath,
                format,
                outputFormat
            );
            resultJson.targetPath = finalTargetPath;
        } else if (outputType === 'binaryData') {
            binaryData = await handleBinaryOutput(finalImage, outputFormat);
        }
        
        // 添加源信息
        addSourceInfo(resultJson, context, itemIndex, inputType as any, sourcePath);
        
        // 添加图像元数据
        addImageMetadata(resultJson, metadata);
        
        // 构建返回数据
        const returnItem: any = {
            json: resultJson,
        };
        
        // 如果输出类型是二进制数据，添加binary属性
        if (outputType === 'binaryData' && binaryData) {
            returnItem.binary = binaryData;
        }
        
        return returnItem;
    }
}