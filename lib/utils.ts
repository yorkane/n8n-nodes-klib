import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// 格式化数字为两位数
export function pad(number: number): string {
    return (number < 10 ? '0' : '') + number;
}

// 格式化时间戳
export function timestamp(): string {
    const d = new Date();
    const date = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = String(d.getFullYear()).slice(2);
    const time = [pad(d.getHours()),
                  pad(d.getMinutes()),
                  pad(d.getSeconds())].join(':');
    return `${year}${date}${month}-${time}`;
}

/**
 * 日志封装类，支持输出到控制台和对象
 */
export class Logger {
    private logs: string[];
    private outputToConsole: boolean;

    constructor(outputToConsole: boolean = true) {
        this.logs = [];
        this.outputToConsole = outputToConsole;
    }

    log(...args: any[]): void {
        const formattedMessage = util.format.apply(null, args);
        const logEntry = `${timestamp()} ${formattedMessage}`;
        if (this.outputToConsole) {
            console.log(logEntry);
        }
        this.logs.push(logEntry);
    }

    error(...args: any[]): void {
        const formattedMessage = util.format.apply(null, args);
        const logEntry = `ERR ${timestamp()} ${formattedMessage}`;
        
        if (this.outputToConsole) {
            console.error(logEntry);
        }
        this.logs.push(logEntry);
    }

    getLogs(): string[] {
        return this.logs;
    }
}

/**
 * 处理文件名以适配Windows文件系统
 * @param filePath - 需要处理的文件路径或文件名
 * @returns 处理后的文件路径或文件名
 */
export function sanitizePath(filePath: string): string {
    // Windows文件系统中的非法字符
    const illegalChars = /[<>:"/\\|?*\x00-\x1F]/g;
    // 处理Unicode控制字符和特殊字符
    const controlChars = /[\u0000-\u001F\u0080-\u009F]/g;
    
    // 分离路径和文件名
    const parsedPath = path.parse(filePath);
    let fileName = parsedPath.name;
    const ext = parsedPath.ext;
    const dir = parsedPath.dir;

    // 处理文件名
    fileName = fileName
        .replace(illegalChars, '_')  // 替换非法字符
        .replace(controlChars, '_')   // 替换控制字符
        .replace(/\s+/g, ' ')         // 合并多个空格
        .trim();                      // 移除首尾空格

    // 处理特殊文件名
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reservedNames.test(fileName)) {
        fileName = '_' + fileName;
    }

    // 限制文件名长度（Windows最大255字符）
    if (fileName.length > 255) {
        fileName = fileName.slice(0, 255);
    }

    // 确保文件名不为空
    if (!fileName) {
        fileName = '_unnamed';
    }

    // 重新组合路径
    if (dir) {
        return path.join(dir, fileName + ext);
    }
    return fileName + ext;
}

/**
 * 将 Node.js 正则表达式转换为 shell 正则表达式
 * @param regex - Node.js 正则表达式或字符串
 * @returns 转换后的 shell 正则表达式
 */
export function convertToShellRegex(regex: string | RegExp): string {
    // 如果是 RegExp 对象，转换为字符串
    let regexStr = regex instanceof RegExp ? regex.source : regex;
    
    // 转义 shell 特殊字符，但保留字符类中的特殊字符
    const shellSpecialChars = /[.*+?^${}()|[\]\\]/g;
    regexStr = regexStr.replace(shellSpecialChars, (match, offset, string) => {
        // 检查是否在字符类内
        const before = string.slice(0, offset);
        const openBrackets = (before.match(/\[/g) || []).length;
        const closeBrackets = (before.match(/\]/g) || []).length;
        
        // 如果在字符类内，且不是 [ 或 ]，则不转义
        if (openBrackets > closeBrackets && match !== '[' && match !== ']') {
            return match;
        }
        return '\\' + match;
    });
    
    // 处理常见的正则表达式差异
    regexStr = regexStr
        .replace(/\\d/g, '[0-9]')           // \d -> [0-9]
        .replace(/\\w/g, '[a-zA-Z0-9_]')    // \w -> [a-zA-Z0-9_]
        .replace(/\\s/g, '[ \t\n\r\f\v]')   // \s -> 空白字符
        .replace(/\\b/g, '\\<')             // \b -> \< (词边界)
        .replace(/\\B/g, '\\>')             // \B -> \> (非词边界)
        .replace(/\\n/g, '\n')              // \n -> 换行符
        .replace(/\\r/g, '\r')              // \r -> 回车符
        .replace(/\\t/g, '\t');             // \t -> 制表符
    
    return regexStr;
}

// 为了支持 CommonJS 导入
const utils = {
    pad,
    timestamp,
    Logger,
    sanitizePath,
    convertToShellRegex,
};

export default utils; 