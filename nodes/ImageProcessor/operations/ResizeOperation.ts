import { IExecuteFunctions } from 'n8n-workflow';
import { IImageOperation, ImageInputData, OperationResult, OutputType } from './types';
import {
    parseResolution,
    setOutputFormat,
    handleFileOutput,
    handleBinaryOutput,
    addSourceInfo,
    addImageMetadata
} from './utils';

export class ResizeOperation implements IImageOperation {
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
        const resizeMode = context.getNodeParameter('resizeMode', itemIndex) as string;
        const additionalDescription = context.getNodeParameter('additionalDescription', itemIndex) as string;
        
        let processedImage = imageProcess;
        let resizeInfo: any = {};
        
        if (resizeMode === 'dimensions') {
            // 指定宽高模式
            const resolution = context.getNodeParameter('resolution', itemIndex) as string;
            let targetWidth: number, targetHeight: number;
            
            if (resolution === 'custom') {
                const customResolution = context.getNodeParameter('customResolution', itemIndex) as string;
                const { width, height } = parseResolution(customResolution);
                targetWidth = width;
                targetHeight = height;
            } else {
                const { width, height } = parseResolution(resolution);
                targetWidth = width;
                targetHeight = height;
            }
            
            resizeInfo = {
                mode: 'dimensions',
                targetWidth,
                targetHeight,
                resolution: resolution === 'custom' ? context.getNodeParameter('customResolution', itemIndex) : resolution
            };
            
            // 获取调整大小选项
            const resizeOptions = context.getNodeParameter('resizeOptions', itemIndex, {}) as any;
            
            const sharpResizeOptions: any = {
                width: targetWidth,
                height: targetHeight,
            };
            
            if (resizeOptions.fit) {
                sharpResizeOptions.fit = resizeOptions.fit;
            }
            if (resizeOptions.position) {
                sharpResizeOptions.position = resizeOptions.position;
            }
            if (resizeOptions.background) {
                sharpResizeOptions.background = resizeOptions.background;
            }
            if (resizeOptions.withoutEnlargement) {
                sharpResizeOptions.withoutEnlargement = resizeOptions.withoutEnlargement;
            }
            if (resizeOptions.withoutReduction) {
                sharpResizeOptions.withoutReduction = resizeOptions.withoutReduction;
            }
            
            processedImage = processedImage.resize(sharpResizeOptions);
        } else if (resizeMode === 'maxDimension') {
            // 按最长边缩放模式
            const maxDimension = context.getNodeParameter('maxDimension', itemIndex) as number;
            
            resizeInfo = {
                mode: 'maxDimension',
                maxDimension
            };
            
            // 根据最长边计算缩放尺寸
            if (metadata && metadata.width && metadata.height) {
                const { width: originalWidth, height: originalHeight } = metadata;
                const maxOriginal = Math.max(originalWidth, originalHeight);
                
                if (maxOriginal > maxDimension) {
                    const scale = maxDimension / maxOriginal;
                    const newWidth = Math.round(originalWidth * scale);
                    const newHeight = Math.round(originalHeight * scale);
                    
                    resizeInfo.calculatedWidth = newWidth;
                    resizeInfo.calculatedHeight = newHeight;
                    resizeInfo.scale = scale;
                    
                    processedImage = processedImage.resize(newWidth, newHeight);
                } else {
                    resizeInfo.note = '图像尺寸已小于或等于指定的最长边尺寸，无需缩放';
                }
            }
        }
        
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
            operation: 'resize',
            format: outputFormat,
            quality,
            outputType,
            success: true,
            inputType,
            resizeInfo
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