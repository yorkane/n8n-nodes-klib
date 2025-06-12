import { IExecuteFunctions } from 'n8n-workflow';
import { IImageOperation, ImageInputData, OperationResult } from './types';
import { addSourceInfo } from './utils';

export class GetImageInfoOperation implements IImageOperation {
    async execute(
        context: IExecuteFunctions,
        inputData: ImageInputData,
        itemIndex: number
    ): Promise<OperationResult> {
        const { metadata, sourcePath } = inputData;
        
        // 获取参数
        const includeExif = context.getNodeParameter('includeExif', itemIndex) as boolean;
        const exifEncoding = context.getNodeParameter('exifEncoding', itemIndex) as string;
        const inputType = context.getNodeParameter('inputType', itemIndex) as string;
        
        const resultJson: Record<string, any> = {
            operation: 'getImageInfo',
            success: true,
            inputType,
            includeExif,
        };
        
        // 只有在includeExif为true时才添加exifEncoding
        if (includeExif) {
            resultJson.exifEncoding = exifEncoding;
        }
        
        // 添加源信息
        addSourceInfo(resultJson, context, itemIndex, inputType as any, sourcePath);
        
        // 添加详细的图像信息
        if (metadata) {
            resultJson.metadata = metadata;
        }
        
        // 根据includeExif参数决定是否添加EXIF信息
        if (includeExif) {
            if (metadata && metadata.exif) {
                // 检查exif数据是否为Buffer类型，如果是则根据选择的编码格式转换
                if (Buffer.isBuffer(metadata.exif)) {
                    try {
                        switch (exifEncoding) {
                            case 'utf-8':
                                resultJson.exif = metadata.exif.toString('utf-8');
                                break;
                            case 'ascii':
                                resultJson.exif = metadata.exif.toString('ascii');
                                break;
                            case 'gb2312':
                            case 'gbk':
                                // Node.js原生不支持GB2312/GBK，使用latin1作为替代
                                resultJson.exif = metadata.exif.toString('latin1');
                                resultJson.encodingNote = `${exifEncoding}编码在Node.js中使用latin1替代`;
                                break;
                            case 'latin1':
                                resultJson.exif = metadata.exif.toString('latin1');
                                break;
                            case 'hex':
                                resultJson.exif = metadata.exif.toString('hex');
                                break;
                            case 'base64':
                                resultJson.exif = metadata.exif.toString('base64');
                                break;
                            case 'raw':
                                resultJson.exif = metadata.exif;
                                break;
                            default:
                                resultJson.exif = metadata.exif.toString('utf-8');
                        }
                        metadata.exif = undefined;
                    } catch (error) {
                        resultJson.exif = metadata.exif;
                        resultJson.exifError = `编码转换失败: ${error}`;
                    }
                } else {
                    // 如果不是Buffer类型，直接使用原始数据
                    resultJson.exif = metadata.exif;
                }
            } else {
                resultJson.exif = null;
                resultJson.exifNote = '该图片没有EXIF信息';
            }
        }
        
        // 添加其他元数据信息
        if (metadata && metadata.icc) {
            resultJson.icc = metadata.icc;
        }
        
        if (metadata && metadata.iptc) {
            resultJson.iptc = metadata.iptc;
        }
        
        if (metadata && metadata.xmp) {
            resultJson.xmp = metadata.xmp;
        }
        
        return {
            json: resultJson,
        };
    }
}