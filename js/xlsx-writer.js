(function () {
  'use strict';

  const encoder = new TextEncoder();
  const crcTable = new Uint32Array(256);
  for (let index = 0; index < crcTable.length; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
    }
    crcTable[index] = value >>> 0;
  }

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    bytes.forEach(byte => { crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8); });
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function xmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function columnName(number) {
    let result = '';
    while (number > 0) {
      const remainder = (number - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      number = Math.floor((number - 1) / 26);
    }
    return result;
  }

  function cellXml(value, reference) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `<c r="${reference}" s="1"><v>${value}</v></c>`;
    }
    if (value == null || value === '') return `<c r="${reference}"/>`;
    return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  }

  function sheetXml(rows) {
    const body = rows.map((row, rowIndex) => {
      const cells = row.map((value, columnIndex) =>
        cellXml(value, `${columnName(columnIndex + 1)}${rowIndex + 1}`)
      ).join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  }

  function workbookFiles(sheets) {
    if (!Array.isArray(sheets) || sheets.length !== 2) {
      throw new TypeError('O arquivo deve conter exatamente duas planilhas.');
    }
    const names = new Set();
    sheets.forEach(sheet => {
      if (!sheet || typeof sheet.name !== 'string' || !sheet.name ||
        sheet.name.length > 31 || /[\\/*?:[\]]/.test(sheet.name) || names.has(sheet.name) ||
        !Array.isArray(sheet.rows)) {
        throw new TypeError('Nome ou conteúdo de planilha inválido.');
      }
      names.add(sheet.name);
    });
    const sheetOverrides = sheets.map((_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    ).join('');
    const workbookSheets = sheets.map((sheet, index) =>
      `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    ).join('');
    const sheetRelationships = sheets.map((_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    ).join('');
    const styleId = `rId${sheets.length + 1}`;
    return [
      ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`],
      ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRelationships}<Relationship Id="${styleId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
      ...sheets.map((sheet, index) => [
        `xl/worksheets/sheet${index + 1}.xml`,
        sheetXml(sheet.rows)
      ])
    ];
  }

  function writeZip(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const date = new Date();
    const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const dosDate = ((Math.max(1980, date.getFullYear()) - 1980) << 9) |
      ((date.getMonth() + 1) << 5) | date.getDate();

    files.forEach(([fileName, content]) => {
      const nameBytes = encoder.encode(fileName);
      const data = encoder.encode(content);
      const checksum = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length + data.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034B50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, dosTime, true);
      localView.setUint16(12, dosDate, true);
      localView.setUint32(14, checksum, true);
      localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true);
      localView.setUint16(26, nameBytes.length, true);
      localView.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      local.set(data, 30 + nameBytes.length);
      localParts.push(local);

      const central = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014B50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, dosTime, true);
      centralView.setUint16(14, dosDate, true);
      centralView.setUint32(16, checksum, true);
      centralView.setUint32(20, data.length, true);
      centralView.setUint32(24, data.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centralParts.push(central);
      offset += local.length;
    });

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054B50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    endView.setUint16(20, 0, true);

    const parts = [...localParts, ...centralParts, end];
    const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let cursor = 0;
    parts.forEach(part => {
      output.set(part, cursor);
      cursor += part.length;
    });
    return output;
  }

  function createWorkbookBytes(sheets) {
    return writeZip(workbookFiles(sheets));
  }

  window.GastoProXlsxWriter = Object.freeze({
    createWorkbook: sheets => new Blob([createWorkbookBytes(sheets)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }),
    createWorkbookBytes,
    crc32,
    escapeXml: xmlEscape
  });
})();
