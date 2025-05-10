const fs = require('fs');
const path = require('path');
const util = require('util');

// 格式化数字为两位数
function pad(number) {
    return (number < 10 ? '0' : '') + number;
}

// 格式化时间戳
function timestamp() {
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
class Logger {
    constructor(outputToConsole = true) {
        this.logs = [];
        this.outputToConsole = outputToConsole;
    }

    log() {
        const args = Array.from(arguments);
        const formattedMessage = util.format.apply(null, args);
        const logEntry = `${timestamp()} ${formattedMessage}`;
        if (this.outputToConsole) {
            console.log(logEntry);
        }
        this.logs.push(logEntry);
    }

    error() {
        const args = Array.from(arguments);
        const formattedMessage = util.format.apply(null, args);
        const logEntry = `ERR ${timestamp()} ${formattedMessage}`;
        
        if (this.outputToConsole) {
            console.error(logEntry);
        }
        this.logs.push(logEntry);
    }

    getLogs() {
        return this.logs;
    }
}

/**
 * 处理文件名以适配Windows文件系统
 * @param {string} filePath - 需要处理的文件路径或文件名
 * @returns {string} - 处理后的文件路径或文件名
 */
function sanitizePath(filePath) {
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

module.exports = {
    pad,
    timestamp,
    Logger,
    sanitizePath: sanitizePath
};

