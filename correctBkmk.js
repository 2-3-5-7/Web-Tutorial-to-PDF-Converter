const {replaceInvalidChars, getLevelsFromFilename, checkDuplicateLines, checkIndentErrors} = require('./util');
const fs = require("fs");
const path = require("path");

async function correctBkmk(inputFile) {
    const file = fs.readFileSync(inputFile, 'utf8');
    const lines = file.split('\r\n');

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line === '') continue;

        line = replaceInvalidChars(line, true);
        const level = getLevelsFromFilename(line).length;
        lines[i] = Array(level - 1).fill('\t').join('') + line;
    }

    const outputFile = path.parse(inputFile).name + '_corrected.txt';
    await fs.promises.writeFile(outputFile, lines.join('\n'));

    return outputFile;
}

(async () => {
    const outputFile = await correctBkmk('FreePic2Pdf_bkmk.txt');
    checkIndentErrors(outputFile);
    checkDuplicateLines(outputFile);
})();

// checkIndentErrors('FreePic2Pdf_bkmk_corrected.txt', true);
// checkDuplicateLines('FreePic2Pdf_bkmk_corrected.txt');
