import * as path from 'path';
import * as fs from 'fs';
import sharp, { Sharp } from 'sharp';
import { IExecuteFunctions } from 'n8n-workflow';
import { ImageInputData, ImageInputType, OutputType, OperationResult } from './types';
import { text } from 'stream/consumers';

// 解析分辨率字符串的工具函数
export function parseResolution(resolutionString: string): { width: number; height: number } {
    const resolutionRegex = /^(\d+)x(\d+)$/;
    const match = resolutionString.match(resolutionRegex);
    
    if (!match) {
        throw new Error(`无效的分辨率格式: ${resolutionString}。请使用格式：宽x高（例如：1920x1080）`);
    }
    
    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);
    
    // 验证宽高值的合理性
    if (width <= 0 || height <= 0) {
        throw new Error(`分辨率值必须大于0: ${width}x${height}`);
    }
    
    if (width > 10000 || height > 10000) {
        throw new Error(`分辨率值过大: ${width}x${height}。最大支持10000x10000`);
    }
    
    return { width, height };
}

// 处理图像输入
export async function processImageInput(
    context: IExecuteFunctions,
    itemIndex: number
): Promise<ImageInputData> {
    const inputType = context.getNodeParameter('inputType', itemIndex) as ImageInputType;
    let imageProcess: Sharp;
    let sourceFormat = '';
    let sourcePath = '';
    
    if (inputType === 'filePath') {
        sourcePath = context.getNodeParameter('sourcePath', itemIndex) as string;
        imageProcess = sharp(sourcePath);
        sourceFormat = path.extname(sourcePath).substring(1).toLowerCase();
    } else if (inputType === 'base64') {
        const base64Image = context.getNodeParameter('base64Image', itemIndex) as string;
        // 移除可能存在的base64前缀（如data:image/jpeg;base64,）
        const base64Data = base64Image.replace(/^data:image\/(\w+);base64,/, (match, ext) => {
            sourceFormat = ext.toLowerCase();
            return '';
        });
        const imageBuffer = Buffer.from(base64Data, 'base64');
        imageProcess = sharp(imageBuffer);
    } else if (inputType === 'binaryData') {
        const binaryProperty = context.getNodeParameter('binaryProperty', itemIndex) as string;
        const items = context.getInputData();
        const binaryData = items[itemIndex].binary;
        
        if (!binaryData || !binaryData[binaryProperty]) {
            throw new Error(`No binary data found for property '${binaryProperty}'`);
        }
        
        // 使用context.helpers.getBinaryDataBuffer获取二进制数据
        const imageBuffer = await context.helpers.getBinaryDataBuffer(itemIndex, binaryProperty);
        imageProcess = sharp(imageBuffer);
        
        // 尝试从二进制数据的mimeType获取格式
        if (binaryData[binaryProperty].mimeType) {
            const mimeType = binaryData[binaryProperty].mimeType;
            sourceFormat = mimeType.split('/')[1];
        }
    } else {
        throw new Error(`Unsupported input type: ${inputType}`);
    }
    
    // 获取图像元数据
    const metadata = await imageProcess.metadata();
    
    return {
        imageProcess,
        sourceFormat,
        sourcePath,
        metadata
    };
}

// 设置输出格式
export function setOutputFormat(
    imageProcess: Sharp,
    format: string,
    sourceFormat: string,
    quality: number,
    additionalDescription?: string
): { imageProcess: Sharp; outputFormat: string } {
    let outputFormat = format;
    if (format === 'same') {
        outputFormat = sourceFormat || 'jpeg';
    }
    
    // 根据不同格式设置不同的输出选项
    switch (outputFormat) {
        case 'jpeg':
            // eslint-disable-next-line no-case-declarations
            const jpegOptions: any = { quality };
            imageProcess = imageProcess.jpeg(jpegOptions);
            // JPEG格式支持EXIF元数据，同时使用ImageDescription和UserComment字段
            if (additionalDescription) {
                imageProcess = imageProcess.withExif({
                    IFD0: {
                        ImageDescription: additionalDescription,
                        UserComment: additionalDescription
                    }
                });
            }
            break;
        case 'png':
            // eslint-disable-next-line no-case-declarations
            const pngOptions: any = { quality };
            imageProcess = imageProcess.png(pngOptions);
            // PNG格式通过EXIF ImageDescription和UserComment字段添加描述
            if (additionalDescription) {
                imageProcess = imageProcess.withExif({
                    IFD0: {
                        ImageDescription: additionalDescription,
                        UserComment: additionalDescription
                    }
                });
            }
            break;
        case 'webp':
            // eslint-disable-next-line no-case-declarations
            const webpOptions: any = { quality };
            imageProcess = imageProcess.webp(webpOptions);
            // WebP格式支持EXIF元数据，同时使用ImageDescription和UserComment字段
            if (additionalDescription) {
                imageProcess = imageProcess.withExif({
                    IFD0: {
                        ImageDescription: additionalDescription,
                        UserComment: additionalDescription
                    }
                });
            }
            break;
        case 'webp-lossless':
            // eslint-disable-next-line no-case-declarations
            const webpLosslessOptions: any = { quality, lossless: true };
            imageProcess = imageProcess.webp(webpLosslessOptions);
            if (additionalDescription) {
                imageProcess = imageProcess.withExif({
                    IFD0: {
                        ImageDescription: additionalDescription,
                        UserComment: additionalDescription
                    }
                });
            }
            break;
        case 'avif':
            // eslint-disable-next-line no-case-declarations
            const avifOptions: any = { quality };
            imageProcess = imageProcess.avif(avifOptions);
            // AVIF格式支持EXIF元数据，使用ImageDescription字段
            if (additionalDescription) {
                imageProcess = imageProcess.withExif({
                    IFD0: {
                        ImageDescription: additionalDescription,
                        UserComment: additionalDescription
                    }
                });
            }
            break;
        case 'tiff':
            // eslint-disable-next-line no-case-declarations
            const tiffOptions: any = { quality };
            // TIFF格式不支持EXIF元数据写入，但可以尝试使用XMP或其他方式
            // 注意：Sharp库明确说明EXIF metadata is unsupported for TIFF output
            if (additionalDescription) {
                // 对于TIFF格式，我们可以尝试保留原有元数据并添加描述
                // 但由于Sharp的限制，可能无法直接写入描述信息
                console.warn('TIFF格式不支持EXIF元数据写入，描述信息可能无法保存');
            }
            imageProcess = imageProcess.tiff(tiffOptions);
            break;
        default:
            imageProcess = imageProcess.jpeg({ quality });
    }
    
    return { imageProcess, outputFormat };
}

// 处理文件输出
export async function handleFileOutput(
    imageProcess: Sharp,
    targetPath: string,
    format: string,
    outputFormat: string
): Promise<string> {
    // 确保文件后缀与格式匹配
    if (format !== 'same') {
        const targetExt = path.extname(targetPath).toLowerCase();
        if(outputFormat === "jpeg"){
            outputFormat = "jpg"
        }
        const formatExt = `.${outputFormat}`;
        
        if (targetExt !== formatExt) {
            // 如果目标路径没有后缀或后缀与格式不匹配，则添加或替换后缀
            if (targetExt === '') {
                targetPath = `${targetPath}${formatExt}`;
            } else {
                targetPath = targetPath.substring(0, targetPath.length - targetExt.length) + formatExt;
            }
        }
    }
    
    // 确保目标路径的目录存在
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    
    try {
        // 保存处理后的图片
        await imageProcess.toFile(targetPath);
        
        // 清理Sharp缓存以释放文件句柄
        // 这有助于避免文件被锁定的问题
        sharp.cache(false);
        
        return targetPath;
    } catch (error) {
        // 确保在错误情况下也清理缓存
        sharp.cache(false);
        throw error;
    }
}

// 处理二进制数据输出
export async function handleBinaryOutput(
    imageProcess: Sharp,
    outputFormat: string
): Promise<Record<string, any>> {
    try {
        const processedBuffer = await imageProcess.toBuffer();
        const binaryPropertyName = 'data';
        if(outputFormat === "jpeg"){
            outputFormat = "jpg"
        }
        
        // 清理Sharp缓存以释放资源
        sharp.cache(false);
        
        return {
            [binaryPropertyName]: {
                data: processedBuffer.toString('base64'),
                mimeType: `image/${outputFormat}`,
                fileExtension: outputFormat,
                fileName: `processed.${outputFormat}`,
            },
        };
    } catch (error) {
        // 确保在错误情况下也清理缓存
        sharp.cache(false);
        throw error;
    }
}

// 添加源信息到结果
export function addSourceInfo(
    resultJson: Record<string, any>,
    context: IExecuteFunctions,
    itemIndex: number,
    inputType: ImageInputType,
    sourcePath?: string
): void {
    if (inputType === 'filePath') {
        resultJson.sourcePath = sourcePath;
    } else if (inputType === 'base64') {
        resultJson.base64Length = (context.getNodeParameter('base64Image', itemIndex) as string).length;
    } else if (inputType === 'binaryData') {
        resultJson.binaryProperty = context.getNodeParameter('binaryProperty', itemIndex) as string;
    }
}

// 添加图像元数据到结果
export function addImageMetadata(
    resultJson: Record<string, any>,
    metadata: any
): void {
    if (metadata) {
        resultJson.originalInfo = {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: metadata.size,
            space: metadata.space,
            channels: metadata.channels,
            density: metadata.density,
            depth: metadata.depth,
            isProgressive: metadata.isProgressive,
            hasProfile: metadata.hasProfile,
            orientation: metadata.orientation,
            chromaSubsampling: metadata.chromaSubsampling,
            hasAlpha: metadata.hasAlpha,
            hasAnimation: metadata.hasAnimation,
            loop: metadata.loop,
            background: metadata.background,
            delay: metadata.delay,
            frameCount: metadata.frameCount,
            pageCount: metadata.pageCount,
        };
    }
}