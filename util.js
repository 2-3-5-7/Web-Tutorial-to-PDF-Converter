const fs = require("fs");

function replaceInvalidChars(filename, recover = false) {
    // https://mythofechelon.co.uk/blog/2020/3/6/how-to-work-around-windows-restricted-characters
    const replaceMap = [
        ['/', '∕'],
        ['\\', '⧵'],
        [':', '꞉'],
        ['*', '⁎'],
        ['?', '？'],
        ['"', '”'],
        ['<', '＜'],
        ['>', '＞'],
        ['|', '⏐']
    ];
    for (let [old, replacement] of replaceMap) {
        filename = recover ? filename.replaceAll(replacement, old) : filename.replaceAll(old, replacement);
    }
    return filename;
}

function getFilenameFromLevels(filename, levels) {
    let prefix = '';
    for (let l of levels) {
        prefix += `${l}.`;
    }
    return (levels.length === 1 ? prefix : prefix.slice(0, -1)) + ' ' + filename;
}

function getLevelsFromFilename(filename) {
    const levels = filename.trim().split(' ')[0].split('.');
    return levels.at(-1) === '' ? levels.slice(0, -1) : levels;
}

function getIndentLevel(line) {
    return line.match(/^\t*/)[0].length;
}

function removeLeadingNumbers(line) {
    const regExp = /^\d+(\.\d+)*\.? /;
    const result = line.match(regExp);
    if (!result) {
        return line;
    }
    // 对于 '123 title' 这种情况，不替换，只替换 '123. title' 这种
    if (!result[0].endsWith('. ') && result[1] === undefined) {
        return line;
    }
    return line.replace(regExp, '');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function checkIndentErrors(filename, corrected = false) {
    const contents = fs.readFileSync(filename, 'utf8');

    let prevIndent = -1;
    let lines = contents.split('\n');
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let indent = getIndentLevel(line);

        if (indent > prevIndent + 1) {
            if (corrected) {
                let wrongIndent = indent;
                const start = i;
                indent = prevIndent + 1;
                lines[i] = '\t'.repeat(indent) + lines[i].trim();

                while (i + 1 < lines.length && getIndentLevel(lines[i + 1]) === wrongIndent) {
                    i++;
                    lines[i] = '\t'.repeat(indent) + lines[i].trim();
                }
                console.log(`Indent corrected line ${start} -> ${i}: ${lines[i].trim()}`);
            } else {
                console.log(`Indent error line ${i} -> ${i + 1}: ${line.trim()}`);
            }
        }

        prevIndent = indent;
    }
    fs.writeFileSync(filename, lines.join('\n'));
    console.log('Indent check done.');
}

function checkDuplicateLines(filename) {
    const contents = fs.readFileSync(filename, 'utf8');
    const lines = contents.split('\n');
    let prevLine = '';
    for (let i = 0; i < lines.length; i++) {
        const line = removeLeadingNumbers(lines[i].trim());

        if (line === prevLine) {
            console.log(`Duplicate line: ${i} -> ${i + 1}: ${line}`);
        }
        prevLine = line;
    }
    console.log('Duplicate check done.');
}

module.exports = {
    replaceInvalidChars,
    getFilenameFromLevels,
    getLevelsFromFilename,
    getIndentLevel,
    removeLeadingNumbers,
    checkIndentErrors,
    checkDuplicateLines,
    sleep,
};