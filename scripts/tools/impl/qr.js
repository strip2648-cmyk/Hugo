'use strict';
const GF_EXP = new Array(512).fill(0);
const GF_LOG = new Array(256).fill(0);
(function init() {
  let value = 1;
  for (let index = 0; index < 255; index += 1) { GF_EXP[index] = value; GF_LOG[value] = index; value <<= 1; if (value & 0x100) value ^= 0x11d; }
  for (let index = 255; index < 512; index += 1) GF_EXP[index] = GF_EXP[index - 255];
}());
function gmul(left, right) { if (!left || !right) return 0; return GF_EXP[GF_LOG[left] + GF_LOG[right]]; }
function generator(degree) {
  let poly = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let position = 0; position < poly.length; position += 1) {
      next[position] ^= poly[position];
      next[position + 1] ^= gmul(poly[position], GF_EXP[index]);
    }
    poly = next;
  }
  return poly;
}
function rsEncode(data, nsym) {
  const poly = generator(nsym);
  const result = new Array(nsym).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let index = 0; index < nsym; index += 1) result[index] ^= gmul(poly[index + 1], factor);
  }
  return result;
}
const VERSIONS = {
  1: { data: 19, ec: 7, blocks: [19] },
  2: { data: 34, ec: 10, blocks: [34] },
  3: { data: 55, ec: 15, blocks: [55] },
  4: { data: 80, ec: 20, blocks: [80] },
  5: { data: 108, ec: 26, blocks: [108] },
  6: { data: 136, ec: 36, blocks: [68, 68] },
};
const ALIGNMENT = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };
function toBits(bytes) { return bytes.map((byte) => byte.toString(2).padStart(8, '0')).join(''); }
function pickVersion(length) {
  for (const version of [1, 2, 3, 4, 5, 6]) {
    const capacity = VERSIONS[version].data * 8;
    const needed = 4 + 8 + length * 8;
    if (needed <= capacity) return version;
  }
  throw new Error('\u0442\u0435\u043a\u0441\u0442\u043e\u0442 \u0435 \u043f\u0440\u0435\u0434\u043e\u043b\u0433 \u0437\u0430 \u0432\u0433\u0440\u0430\u0434\u0435\u043d\u0438\u043e\u0442 QR \u0435\u043d\u043a\u043e\u0434\u0435\u0440 (\u043c\u0430\u043a\u0441 134 \u0431\u0430\u0458\u0442\u0438)');
}
function buildCodewords(text, version) {
  const bytes = Buffer.from(text, 'utf8');
  const spec = VERSIONS[version];
  const capacityBits = spec.data * 8;
  let bits = `0100${bytes.length.toString(2).padStart(8, '0')}`;
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  bits += '0'.repeat(Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits += '0';
  const codewords = [];
  for (let index = 0; index < bits.length; index += 8) codewords.push(parseInt(bits.slice(index, index + 8), 2));
  const pad = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < spec.data) { codewords.push(pad[padIndex % 2]); padIndex += 1; }
  const dataBlocks = [];
  let offset = 0;
  for (const length of spec.blocks) { dataBlocks.push(codewords.slice(offset, offset + length)); offset += length; }
  const ecBlocks = dataBlocks.map((block) => rsEncode(block, spec.ec));
  const interleaved = [];
  const maxData = Math.max(...dataBlocks.map((block) => block.length));
  for (let index = 0; index < maxData; index += 1) for (const block of dataBlocks) if (index < block.length) interleaved.push(block[index]);
  for (let index = 0; index < spec.ec; index += 1) for (const block of ecBlocks) interleaved.push(block[index]);
  return interleaved;
}
function blank(size) { return Array.from({ length: size }, () => new Array(size).fill(null)); }
function buildMatrix(version, codewords) {
  const size = 17 + 4 * version;
  const matrix = blank(size);
  const reserved = blank(size).map((row) => row.map(() => false));
  const setFunction = (row, column, value) => { if (row < 0 || column < 0 || row >= size || column >= size) return; matrix[row][column] = value; reserved[row][column] = true; };
  function drawFinder(row, column) {
    for (let rowOffset = -1; rowOffset <= 7; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 7; columnOffset += 1) {
        const within = rowOffset >= 0 && rowOffset <= 6 && columnOffset >= 0 && columnOffset <= 6;
        const border = rowOffset === 0 || rowOffset === 6 || columnOffset === 0 || columnOffset === 6;
        const core = rowOffset >= 2 && rowOffset <= 4 && columnOffset >= 2 && columnOffset <= 4;
        setFunction(row + rowOffset, column + columnOffset, within && (border || core) ? 1 : 0);
      }
    }
  }
  drawFinder(0, 0); drawFinder(0, size - 7); drawFinder(size - 7, 0);
  for (let index = 8; index < size - 8; index += 1) { setFunction(6, index, index % 2 === 0 ? 1 : 0); setFunction(index, 6, index % 2 === 0 ? 1 : 0); }
  const centers = ALIGNMENT[version];
  const last = centers[centers.length - 1];
  for (const row of centers) {
    for (const column of centers) {
      if ((row === 6 && column === 6) || (row === 6 && column === last) || (row === last && column === 6)) continue;
      for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
        for (let columnOffset = -2; columnOffset <= 2; columnOffset += 1) {
          const ring = Math.max(Math.abs(rowOffset), Math.abs(columnOffset));
          setFunction(row + rowOffset, column + columnOffset, ring !== 1 ? 1 : 0);
        }
      }
    }
  }
  setFunction(size - 8, 8, 1);
  for (let index = 0; index < 9; index += 1) { setFunction(8, index, 0); setFunction(index, 8, 0); }
  for (let index = 0; index < 8; index += 1) { setFunction(8, size - 1 - index, 0); setFunction(size - 1 - index, 8, 0); }
  const dataBits = codewords.map((byte) => byte.toString(2).padStart(8, '0')).join('');
  let bitIndex = 0;
  let upward = true;
  for (let column = size - 1; column > 0; column -= 2) {
    if (column === 6) column = 5;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const current of [column, column - 1]) {
        if (reserved[row][current]) continue;
        matrix[row][current] = bitIndex < dataBits.length ? Number(dataBits[bitIndex]) : 0;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
  const maskFns = [
    (row, column) => (row + column) % 2 === 0,
    (row) => row % 2 === 0,
    (row, column) => column % 3 === 0,
    (row, column) => (row + column) % 3 === 0,
    (row, column) => (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0,
    (row, column) => ((row * column) % 2) + ((row * column) % 3) === 0,
    (row, column) => (((row * column) % 2) + ((row * column) % 3)) % 2 === 0,
    (row, column) => (((row + column) % 2) + ((row * column) % 3)) % 2 === 0,
  ];
  let best = { mask: 0, penalty: Infinity, grid: null };
  for (let index = 0; index < maskFns.length; index += 1) {
    const grid = matrix.map((row) => row.slice());
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        if (reserved[row][column]) continue;
        if (maskFns[index](row, column)) grid[row][column] = grid[row][column] ? 0 : 1;
      }
    }
    drawFormat(grid, size, 0, index);
    const penalty = penaltyScore(grid, size);
    if (penalty < best.penalty) best = { mask: index, penalty, grid };
  }
  return { size, grid: best.grid, mask: best.mask, penalty: best.penalty };
}
function formatBits(mask) {
  const data = (1 << 3) | mask;
  let remainder = data;
  for (let index = 0; index < 10; index += 1) remainder = (remainder << 1) ^ (((remainder >> 9) & 1) * 0x537);
  return ((data << 10) | remainder) ^ 0x5412;
}
function drawFormat(grid, size, eccBits, mask) {
  const bits = formatBits(mask);
  const bit = (index) => (bits >> index) & 1;
  for (let index = 0; index <= 5; index += 1) grid[8][index] = bit(index);
  grid[8][7] = bit(6);
  grid[8][8] = bit(7);
  grid[7][8] = bit(8);
  for (let index = 9; index <= 14; index += 1) grid[14 - index][8] = bit(index);
  for (let index = 0; index <= 7; index += 1) grid[size - 1 - index][8] = bit(index);
  for (let index = 8; index <= 14; index += 1) grid[8][size - 15 + index] = bit(index);
  grid[size - 8][8] = 1;
}
function penaltyScore(grid, size) {
  let penalty = 0;
  const runs = (line) => {
    let score = 0;
    let run = 1;
    for (let index = 1; index < line.length; index += 1) {
      if (line[index] === line[index - 1]) { run += 1; continue; }
      if (run >= 5) score += 3 + (run - 5);
      run = 1;
    }
    if (run >= 5) score += 3 + (run - 5);
    return score;
  };
  for (let index = 0; index < size; index += 1) {
    penalty += runs(grid[index]);
    penalty += runs(grid.map((row) => row[index]));
  }
  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const value = grid[row][column];
      if (value === grid[row][column + 1] && value === grid[row + 1][column] && value === grid[row + 1][column + 1]) penalty += 3;
    }
  }
  const patternA = '10111010000';
  const patternB = '00001011101';
  for (let index = 0; index < size; index += 1) {
    const rowText = grid[index].join('');
    const columnText = grid.map((row) => row[index]).join('');
    for (let offset = 0; offset <= size - 11; offset += 1) {
      const rowSlice = rowText.slice(offset, offset + 11);
      const columnSlice = columnText.slice(offset, offset + 11);
      if (rowSlice === patternA || rowSlice === patternB) penalty += 40;
      if (columnSlice === patternA || columnSlice === patternB) penalty += 40;
    }
  }
  let dark = 0;
  for (const row of grid) for (const value of row) if (value) dark += 1;
  penalty += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
  return penalty;
}
function encode(text) {
  const value = String(text || '');
  if (!value.trim()) throw new Error('text is required');
  const version = pickVersion(Buffer.byteLength(value, 'utf8'));
  const codewords = buildCodewords(value, version);
  const built = buildMatrix(version, codewords);
  return { version, size: built.size, mask: built.mask, penalty: built.penalty, matrix: built.grid };
}
function toText(matrix, quiet = 2) {
  const size = matrix.length;
  const lines = [];
  for (let index = 0; index < quiet; index += 1) lines.push('\u2588\u2588'.repeat(size + quiet * 2));
  for (const row of matrix) {
    let line = '\u2588\u2588'.repeat(quiet);
    for (const value of row) line += value ? '\u2588\u2588' : '  ';
    lines.push(`${line}${'\u2588\u2588'.repeat(quiet)}`);
  }
  for (let index = 0; index < quiet; index += 1) lines.push('\u2588\u2588'.repeat(size + quiet * 2));
  return lines.join('\n');
}
function toSvg(matrix, quiet = 4, scale = 8) {
  const size = matrix.length + quiet * 2;
  let path = '';
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix.length; column += 1) {
      if (!matrix[row][column]) continue;
      path += `M${(column + quiet) * scale} ${(row + quiet) * scale}h${scale}v${scale}h-${scale}z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size * scale}" height="${size * scale}" viewBox="0 0 ${size * scale} ${size * scale}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
}
module.exports = { encode, toText, toSvg, VERSIONS, rsEncode, formatBits };
