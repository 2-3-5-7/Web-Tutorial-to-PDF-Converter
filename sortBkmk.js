const fs = require('fs');
const path = require('path');
const { getIndentLevel, removeLeadingNumbers, checkIndentErrors, checkDuplicateLines } = require('./util');


async function sortBkmk(inputFile) {
    const file = fs.readFileSync(inputFile, 'utf8');
    const lines = file.split('\r\n');

    let outLines = [];

    for (let line of lines) {
        if (line.trim() === '') continue;
        const [_, pageNum] = line.trim().split('\t');
        outLines.push([line, Number(pageNum)]);
    }

    outLines = outLines.sort((a, b) => a[1] - b[1]).map(x => x[0]);

    const outputFile = path.parse(inputFile).name + '_sorted.txt';
    await fs.promises.writeFile(outputFile, outLines.join('\n'));

    return outputFile;
}

(async () => {
    const outputFile = await sortBkmk('FreePic2Pdf_bkmk.txt');
    checkIndentErrors(outputFile);
    checkDuplicateLines(outputFile);
})();

// checkIndentErrors('FreePic2Pdf_bkmk_sorted.txt', true);
// checkDuplicateLines('FreePic2Pdf_bkmk_sorted.txt');
