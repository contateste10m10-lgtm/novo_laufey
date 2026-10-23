/* BlazarLab privado 13.02 — importação local, qualidade e gráficos de análise. */
(() => {
  'use strict';
  const VERSION = '13.02';
  const BAND_DEFS = [
    { key: '14_20', label: '14–20 keV', low: 14, high: 20 },
    { key: '20_24', label: '20–24 keV', low: 20, high: 24 },
    { key: '24_35', label: '24–35 keV', low: 24, high: 35 },
    { key: '35_50', label: '35–50 keV', low: 35, high: 50 },
    { key: '50_75', label: '50–75 keV', low: 50, high: 75 },
    { key: '75_100', label: '75–100 keV', low: 75, high: 100 },
    { key: '100_150', label: '100–150 keV', low: 100, high: 150 },
    { key: '150_195', label: '150–195 keV', low: 150, high: 195 }
  ];
  const MAX_FILE_BYTES = 150 * 1024 * 1024;
  const MAX_ROWS_WARN = 30000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const state = {
    data: null, file: null, rawBuffer: null, parsedRows: [], headers: [], mapping: { time: '' },
    synthetic: false, results: null, jobId: 0, worker: null, busy: false, previewBand: 0,
    previewOverlay: false, fitLabel: 'Tempo', parseWarnings: []
  };

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function setStatus(message, kind = 'info') {
    const box = $('#labStatus'); if (!box) return;
    box.dataset.kind = kind;
    box.replaceChildren();
    const dot = document.createElement('span'); dot.className = 'lab-status-dot'; dot.setAttribute('aria-hidden', 'true');
    const text = document.createElement('div'); text.textContent = message;
    box.append(dot, text);
  }
  function setProgress(current, total, label = '') {
    const wrap = $('#labProgressWrap'), fill = $('#labProgressFill'), title = $('#labProgressTitle'), value = $('#labProgressValue');
    if (!wrap) return;
    wrap.hidden = false;
    const pct = total > 0 ? Math.round(current / total * 100) : 0;
    fill.style.width = `${pct}%`;
    const progress = wrap.querySelector('[role=progressbar]'); if (progress) progress.setAttribute('aria-valuenow', String(pct));
    title.textContent = label || (current >= total ? 'Etapa concluída' : 'Calculando métricas…');
    value.textContent = total ? `${current}/${total} bandas · ${pct}%` : 'Preparando';
  }
  function hideProgress() { $('#labProgressWrap').hidden = true; }
  function parseNumber(value) {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s || /^(na|n\/a|null|nan|none|--|—|\*)$/i.test(s)) return null;
    let normalized = s;
    if (normalized.includes(',') && !normalized.includes('.')) normalized = normalized.replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  function parseCsvLine(line, delimiter) {
    const out = []; let cell = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) { out.push(cell.trim()); cell = ''; }
      else cell += ch;
    }
    out.push(cell.trim());
    return out;
  }
  function splitDelimitedText(text) {
    const lines = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    const dataLines = [], commentLines = [];
    for (const line of lines) {
      const t = line.trim(); if (!t) continue;
      if (/^(#|!)/.test(t)) { commentLines.push(t.replace(/^(#|!)/, '').trim()); continue; }
      dataLines.push(line);
    }
    if (!dataLines.length) throw new Error('O arquivo não contém linhas de dados reconhecíveis.');
    const sample = dataLines.slice(0, 8);
    const candidates = [',', '\t', ';', '|'];
    const countOutsideQuotes = (line, delimiter) => {
      let quoted = false, count = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          if (quoted && line[i + 1] === '"') { i++; continue; }
          quoted = !quoted;
        } else if (!quoted && line[i] === delimiter) count++;
      }
      return count;
    };
    const scored = candidates.map(d => {
      const counts = sample.map(line => countOutsideQuotes(line, d)).filter(n => n > 0);
      const consistency = counts.length ? counts.filter(n => n === counts[0]).length / counts.length : 0;
      const average = counts.length ? counts.reduce((a, n) => a + n, 0) / counts.length : 0;
      return { d, score: counts.length ? average * (0.75 + 0.25 * consistency) : 0, count: counts.length };
    }).sort((a, b) => b.score - a.score || b.count - a.count);
    const delimiter = scored[0]?.score > 0 ? scored[0].d : 'whitespace';
    let rows = dataLines.map(line => delimiter === 'whitespace' ? line.trim().split(/\s+/) : parseCsvLine(line, delimiter));
    const width = Math.max(...rows.map(row => row.length));
    rows = rows.filter(row => row.length >= Math.min(2, width));
    const first = rows[0] || [];
    const firstNumeric = first.filter(v => parseNumber(v) != null).length;
    const headerless = firstNumeric >= Math.max(1, Math.ceil(first.length * 0.7));
    let headers;
    if (headerless) headers = first.map((_, i) => `Coluna ${i + 1}`);
    else headers = first.map((name, i) => {
      const safe = String(name || '').trim(); return safe || `Coluna ${i + 1}`;
    });
    let bodyRows = headerless ? rows : rows.slice(1);
    const maxWidth = Math.max(headers.length, ...bodyRows.map(row => row.length));
    while (headers.length < maxWidth) headers.push(`Coluna ${headers.length + 1}`);
    const normalizedRows = bodyRows.map(row => Array.from({ length: maxWidth }, (_, i) => row[i] ?? ''));
    if (!normalizedRows.length) throw new Error('Não encontrei linhas depois do cabeçalho.');
    const commentsHeader = commentLines.find(line => line.split(/\s+/).length >= maxWidth);
    const warnings = [];
    if (headerless) warnings.push('O arquivo parece não ter cabeçalho; os nomes foram gerados como Coluna 1, Coluna 2…');
    if (normalizedRows.length > MAX_ROWS_WARN) warnings.push(`O arquivo contém ${normalizedRows.length.toLocaleString('pt-BR')} linhas; o cálculo pode demorar.`);
    return { headers, rows: normalizedRows, delimiter, headerless, commentLines, commentsHeader, warnings };
  }
  function normalizeColumnName(name) { return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''); }
  function parseTimeValue(value) {
    const numeric = parseNumber(value); if (numeric != null) return numeric;
    const text = String(value ?? '').trim(); if (!text) return null;
    const ms = Date.parse(text); return Number.isFinite(ms) ? ms / 86400000 : null;
  }
  function bandScore(name, type) {
    const n = normalizeColumnName(name);
    if (type === 'time') {
      if (/^(TIME|MJD|TIME_MJD|TJD|MET|DATE|DATETIME|JD|BJD|BTJD|TIME_DAYS)$/.test(n)) return 100;
      if (/(^|_)(TIME|MJD|TJD|DATE|JD)($|_)/.test(n)) return 55;
      return -1;
    }
    const isErr = /(ERR|ERROR|UNC|SIGMA|UNCERTAINTY|STDERR|E_RATE|RATE_ERR)/.test(n);
    if (type === 'error' && !isErr) return -1;
    if (type === 'rate' && isErr) return -1;
    const isRate = /(RATE|FLUX|COUNTS|COUNT|CRAB|INTENSITY|Y$|VALUE)/.test(n);
    let score = isRate ? 10 : 0;
    const defs = BAND_DEFS;
    const d = defs.findIndex(b => {
      const pattern = new RegExp(`(?:^|_)(?:${b.key}|${b.low}_${b.high}|${b.low}TO${b.high}|BAND_?${defs.indexOf(b) + 1})(?:_|$)`);
      return pattern.test(n) || n.includes(`${b.low}${b.high}`);
    });
    if (d >= 0) score += 40;
    if (/^RATE_?[1-8]$/.test(n) || /^ERROR_?[1-8]$/.test(n) || /^ERR_?[1-8]$/.test(n)) score += 25;
    if (type === 'rate' && /RATE/.test(n)) score += 12;
    if (type === 'error' && /(ERR|ERROR)/.test(n)) score += 12;
    return score;
  }
  function findLikelyColumn(headers, type, bandIndex = 0) {
    const normalized = headers.map(normalizeColumnName);
    if (type === 'time') {
      const exact = [/^TIME$/, /^TIME_MJD$/, /^MJD$/, /^TJD$/, /^MET$/, /^DATE$/, /^DATETIME$/, /^JD$/, /^BJD$/, /^BTJD$/];
      for (const pattern of exact) { const index = normalized.findIndex(name => pattern.test(name)); if (index >= 0) return index; }
      const fuzzy = normalized.findIndex(name => /(^|_)(TIME|MJD|TJD|DATE|JD|BJD|BTJD)(_|$)/.test(name) && !/(ERR|ERROR|UNC)/.test(name));
      return fuzzy;
    }
    const def = BAND_DEFS[bandIndex];
    const errorType = type === 'error';
    const words = errorType ? /(^|_)(ERR|ERROR|UNC|UNCERTAINTY|SIGMA|RATE_ERR|RATE_ERROR)(_|$)/ : /(^|_)(RATE|FLUX|COUNTS|COUNT|INTENSITY|VALUE|Y)(_|$)/;
    const rejects = errorType ? /(^|_)(RATE|FLUX|COUNTS|COUNT|INTENSITY|VALUE|Y)(_|$)/ : /(^|_)(ERR|ERROR|UNC|UNCERTAINTY|SIGMA)(_|$)/;
    const tokens = [def.key, `${def.low}_${def.high}`, `${def.low}TO${def.high}`, `BAND_${bandIndex + 1}`, `BAND${bandIndex + 1}`];
    const candidates = normalized.map((name, index) => ({ name, index })).filter(item => {
      if (errorType ? !/(ERR|ERROR|UNC|UNCERTAINTY|SIGMA)/.test(item.name) : rejects.test(item.name)) return false;
      const bandMatches = tokens.some(token => item.name.includes(token));
      if (!bandMatches) return false;
      return errorType ? /ERR|ERROR|UNC|UNCERTAINTY|SIGMA/.test(item.name) : words.test(item.name);
    });
    if (candidates.length) {
      candidates.sort((a, b) => {
        const aa = a.name.startsWith(errorType ? 'ERROR_' : 'RATE_') ? 2 : 0;
        const bb = b.name.startsWith(errorType ? 'ERROR_' : 'RATE_') ? 2 : 0;
        return bb - aa;
      });
      return candidates[0].index;
    }
    // Permit a generic single-band light curve only for the first band, never
    // duplicate the same RATE/ERROR column across all eight bands.
    if (bandIndex !== 0) return -1;
    const generic = normalized.map((name, index) => ({ name, index })).filter(item => {
      if (errorType) return /^(ERR|ERROR|UNCERTAINTY|SIGMA|RATE_ERROR|RATE_ERR|YERR)$/.test(item.name);
      return /^(RATE|FLUX|COUNTS|COUNT_RATE|INTENSITY|VALUE|Y|FLUX_DENSITY)$/.test(item.name);
    });
    return generic[0]?.index ?? -1;
  }

  function bytesToText(buffer) { return new TextDecoder('utf-8', { fatal: false }).decode(buffer); }
  async function maybeGunzip(buffer, fileName) {
    const bytes = new Uint8Array(buffer); const magic = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (!magic && !/\.gz$/i.test(fileName || '')) return buffer;
    if (typeof DecompressionStream !== 'function') throw new Error('Este navegador não consegue descomprimir .gz nativamente. Descompacte o arquivo e abra o CSV/TXT resultante.');
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([buffer]).stream().pipeThrough(ds);
    return await new Response(stream).arrayBuffer();
  }
  function readFitsHeader(bytes, offset) {
    const block = 2880, cardSize = 80; let header = '', consumed = 0, foundEnd = false;
    const decoder = new TextDecoder('ascii');
    while (offset + consumed + cardSize <= bytes.length && !foundEnd) {
      const card = decoder.decode(bytes.subarray(offset + consumed, offset + consumed + cardSize));
      header += card + '\n'; consumed += cardSize;
      if (card.slice(0, 8).trim() === 'END') foundEnd = true;
      if (consumed % block === 0 && !foundEnd) continue;
    }
    if (!foundEnd) throw new Error('Cabeçalho FITS incompleto (cartão END não encontrado).');
    const aligned = Math.ceil(consumed / block) * block;
    const values = {};
    for (const card of header.split('\n')) {
      if (card.slice(8, 10) !== '= ') continue;
      const key = card.slice(0, 8).trim(), valuePart = card.slice(10).split('/')[0].trim();
      if (!key) continue;
      if (valuePart.startsWith("'")) values[key] = valuePart.replace(/^'/, '').replace(/'\s*$/, '').trim();
      else if (valuePart === 'T') values[key] = true;
      else if (valuePart === 'F') values[key] = false;
      else { const v = Number(valuePart); values[key] = Number.isFinite(v) ? v : valuePart; }
    }
    return { values, headerBytes: aligned };
  }
  function fitsForm(form) {
    const match = String(form || '').trim().match(/^(\d*)([LXBIJKAEDCM PQ])$/i);
    if (!match || /[PQ]/i.test(match[2])) return null;
    const count = Number(match[1] || 1), type = match[2].toUpperCase();
    const bytesPer = { L: 1, X: null, B: 1, I: 2, J: 4, K: 8, A: 1, E: 4, D: 8, C: 8, M: 16 }[type];
    if (!Number.isFinite(bytesPer) || bytesPer == null) return null;
    return { count, type, bytes: count * bytesPer, bytesPer };
  }
  function fitsNumber(view, offset, type) {
    switch (type) {
      case 'B': return view.getUint8(offset);
      case 'I': return view.getInt16(offset, false);
      case 'J': return view.getInt32(offset, false);
      case 'K': { const v = view.getBigInt64(offset, false); const n = Number(v); return Number.isSafeInteger(n) ? n : n; }
      case 'E': return view.getFloat32(offset, false);
      case 'D': return view.getFloat64(offset, false);
      case 'L': return view.getUint8(offset) === 84 ? 1 : 0;
      default: return null;
    }
  }
  function parseFitsArray(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer), decoder = new TextDecoder('ascii');
    let offset = 0, found = null, hduNo = 0;
    while (offset + 2880 <= bytes.length && hduNo < 50) {
      const header = readFitsHeader(bytes, offset); const h = header.values; const dataOffset = offset + header.headerBytes;
      const naxis = Number(h.NAXIS || 0), bitpix = Math.abs(Number(h.BITPIX || 8));
      let dataSize = 0;
      if (naxis === 0) dataSize = 0;
      else { let product = 1; for (let i = 1; i <= naxis; i++) product *= Math.max(0, Number(h[`NAXIS${i}`] || 0)); dataSize = product * bitpix / 8; }
      if (h.XTENSION === 'BINTABLE' && Number(h.NAXIS2) > 0) {
        const rowLength = Number(h.NAXIS1 || 0), rowCount = Number(h.NAXIS2 || 0), fieldCount = Number(h.TFIELDS || 0);
        if (!rowLength || !rowCount || !fieldCount || dataOffset + rowLength * rowCount > bytes.length) throw new Error('Tabela binária FITS incompleta ou inválida.');
        const fields = []; let fieldOffset = 0;
        for (let i = 1; i <= fieldCount; i++) {
          const form = fitsForm(h[`TFORM${i}`]);
          if (!form) throw new Error(`Formato FITS não suportado em ${h[`TTYPE${i}`] || `coluna ${i}`}: ${h[`TFORM${i}`]}.`);
          fields.push({ name: String(h[`TTYPE${i}`] || `FITS_${i}`).trim(), unit: h[`TUNIT${i}`] || '', offset: fieldOffset, ...form, scale: Number(h[`TSCAL${i}`] ?? 1), zero: Number(h[`TZERO${i}`] ?? 0) }); fieldOffset += form.bytes;
        }
        const vectorFields = fields.some(f => f.count > 1 && ['E','D','J','I','K','B'].includes(f.type));
        const outNames = [];
        for (const f of fields) {
          if (f.type === 'A') outNames.push(f.name);
          else if (f.count > 1 && ['E','D','J','I','K','B'].includes(f.type)) {
            for (let j = 0; j < f.count; j++) {
              const isFlux = /(RATE|FLUX|COUNT)/i.test(f.name), isErr = /(ERR|ERROR|UNC)/i.test(f.name);
              const label = isFlux || isErr ? BAND_DEFS[j]?.key : `ELEMENT_${j + 1}`;
              outNames.push(`${normalizeColumnName(f.name)}_${label || `ELEMENT_${j + 1}`}`);
            }
          } else outNames.push(f.name);
        }
        const rows = [];
        for (let r = 0; r < rowCount; r++) {
          const rowBase = dataOffset + r * rowLength, out = [];
          for (const f of fields) {
            if (f.type === 'A') { out.push(decoder.decode(bytes.subarray(rowBase + f.offset, rowBase + f.offset + f.count)).trim()); continue; }
            if (f.type === 'C' || f.type === 'M') throw new Error(`Coluna complexa FITS não suportada: ${f.name}.`);
            for (let j = 0; j < f.count; j++) {
              const v = fitsNumber(view, rowBase + f.offset + j * f.bytesPer, f.type);
              out.push(v == null || !Number.isFinite(v) ? '' : String(v * f.scale + f.zero));
            }
          }
          rows.push(out);
        }
        found = { headers: outNames, rows, delimiter: 'FITS', headerless: false, warnings: [], fits: true, hdu: hduNo };
        break;
      }
      offset = dataOffset + Math.ceil(dataSize / 2880) * 2880; hduNo++;
    }
    if (!found) throw new Error('Não encontrei uma extensão FITS BINTABLE com observações tabulares.');
    return found;
  }

  async function parseFile(file) {
    if (file.size > MAX_FILE_BYTES) throw new Error('Arquivo acima de 150 MiB. Para evitar esgotar a memória do navegador, divida a série em partes menores.');
    const originalBuffer = await file.arrayBuffer();
    const buffer = await maybeGunzip(originalBuffer, file.name);
    if (buffer.byteLength > MAX_FILE_BYTES) throw new Error('O arquivo descompactado ultrapassa 150 MiB. Para proteger a memória do navegador, descompacte/particione os dados e tente novamente.');
    const bytes = new Uint8Array(buffer);
    const isFits = bytes.length >= 9 && (bytesToText(bytes.subarray(0, 9)).startsWith('SIMPLE') || /\.fits?(\.gz)?$/i.test(file.name));
    let parsed;
    if (isFits) parsed = parseFitsArray(buffer);
    else parsed = splitDelimitedText(bytesToText(buffer));
    state.file = file; state.rawBuffer = originalBuffer;
    return parsed;
  }
  function initFromParsed(parsed, options = {}) {
    state.headers = parsed.headers; state.parsedRows = parsed.rows; state.data = parsed; state.results = null;
    state.synthetic = Boolean(options.synthetic); state.parseWarnings = parsed.warnings || [];
    const detectedTime = findLikelyColumn(state.headers, 'time');
    state.mapping = { time: detectedTime >= 0 ? String(detectedTime) : '__row_index__', bands: [] };
    for (let i = 0; i < BAND_DEFS.length; i++) {
      let rate = findLikelyColumn(state.headers, 'rate', i); let error = findLikelyColumn(state.headers, 'error', i);
      if (i === 0 && rate < 0) {
        const candidates = state.headers.map((h, idx) => ({ h, idx })).filter(x => x.idx !== Number(state.mapping.time) && !/(ERR|ERROR|UNC|SIGMA)/i.test(x.h));
        if (candidates.length === 1) rate = candidates[0].idx;
      }
      state.mapping.bands.push({ rate: rate >= 0 ? String(rate) : '', error: error >= 0 ? String(error) : '' });
    }
    renderMapping(); renderFileMetadata(); renderPreview(); renderDiagnostics(null); renderResultsEmpty();
    $('#labCalcBtn').disabled = !getSelectedBandRows().some(b => b.points.length >= 4); $('#labResetBtn').disabled = false; $('#labExportCsvBtn').disabled = true; $('#labExportJsonBtn').disabled = true;
    $('#lab-preview-area').hidden = false; $('#lab-config-area').hidden = false; $('#lab-results-area').hidden = true;
    const n = parsed.rows.length, format = parsed.fits ? 'FITS BINTABLE' : `texto (${parsed.delimiter === 'whitespace' ? 'espaços' : parsed.delimiter === '\t' ? 'tabulação' : parsed.delimiter})`;
    setStatus(`${n.toLocaleString('pt-BR')} linhas detectadas; ${state.headers.length} colunas em ${format}. Confira o mapeamento e a prévia antes de calcular.`, 'success');
    if (state.parseWarnings.length) setStatus(`${n.toLocaleString('pt-BR')} linhas detectadas. ${state.parseWarnings.join(' ')} Confira a prévia antes de calcular.`, 'info');
    refreshPreviewChart();
  }
  function renderFileMetadata() {
    const name = state.file?.name || (state.synthetic ? 'demonstração-sintética.csv' : 'Dados');
    const size = state.rawBuffer?.byteLength ?? state.file?.size ?? 0;
    $('#labFileName').textContent = name;
    $('#labFileSize').textContent = size ? `${(size / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KiB` : 'em memória';
    $('#labFileRows').textContent = `${state.parsedRows.length.toLocaleString('pt-BR')} linhas`;
    $('#labFileKind').textContent = state.synthetic ? 'SINTÉTICO' : (state.data?.fits ? 'FITS' : 'DADOS LOCAIS');
    $('#labFileKind').classList.toggle('lab-chip-synthetic', state.synthetic);
    $('#labFileMeta').hidden = false;
  }
  function selectOptions(selected = '', includeNone = true) {
    const options = [];
    if (includeNone) options.push(`<option value="">— Não mapear —</option>`);
    state.headers.forEach((h, i) => options.push(`<option value="${i}"${String(i) === String(selected) ? ' selected' : ''}>${esc(h)}</option>`));
    return options.join('');
  }
  function invalidateResults(message = 'A configuração mudou. Execute novamente os cálculos para atualizar os resultados.') {
    if (state.busy) cancelWorker();
    state.results = null;
    state.analysisOptions = null;
    $('#lab-results-area').hidden = true;
    $('#labExportCsvBtn').disabled = true;
    $('#labExportJsonBtn').disabled = true;
    renderResultsEmpty();
    if (state.data) setStatus(message, 'info');
  }
  function updateCalculateAvailability() {
    $('#labCalcBtn').disabled = !state.data || !getSelectedBandRows().some(b => b.points.length >= 4) || state.busy;
  }
  function renderMapping() {
    const timeSelect = $('#labTimeColumn'); timeSelect.innerHTML = `<option value="__row_index__"${state.mapping.time === '__row_index__' ? ' selected' : ''}>Índice da observação (sem timestamp)</option>` + selectOptions(state.mapping.time, false);
    const host = $('#labBandMapping'); host.replaceChildren();
    BAND_DEFS.forEach((band, i) => {
      const map = state.mapping.bands[i] || { rate: '', error: '' };
      const card = document.createElement('div'); card.className = 'lab-mapping-card';
      card.innerHTML = `<div class="lab-mapping-card-head"><strong>Banda ${i + 1}</strong><small>${band.label}</small></div><div class="lab-mapping-fields"><div class="lab-field-group"><label for="labRate${i}">Taxa / fluxo</label><select class="lab-select" id="labRate${i}" data-map-band="${i}" data-map-type="rate">${selectOptions(map.rate)}</select></div><div class="lab-field-group"><label for="labError${i}">Incerteza / erro</label><select class="lab-select" id="labError${i}" data-map-band="${i}" data-map-type="error">${selectOptions(map.error)}</select></div></div>`;
      host.append(card);
    });
    $$('[data-map-band]', host).forEach(sel => sel.addEventListener('change', e => {
      const t = e.target, i = Number(t.dataset.mapBand); state.mapping.bands[i][t.dataset.mapType] = t.value;
      invalidateResults(); updateCalculateAvailability();
      refreshPreviewChart(); renderDiagnostics(null);
    }));
  }
  function selectedColumns() { return { time: state.mapping.time === '__row_index__' ? '__row_index__' : Number(state.mapping.time), bands: state.mapping.bands.map(m => ({ rate: m.rate === '' ? -1 : Number(m.rate), error: m.error === '' ? -1 : Number(m.error) })) }; }
  function extractMappedRows() {
    const mapping = selectedColumns(), result = [];
    state.parsedRows.forEach((row, i) => {
      const rawTime = mapping.time === '__row_index__' ? i : row[mapping.time]; const x = mapping.time === '__row_index__' ? i : parseTimeValue(rawTime);
      const mapped = { rowIndex: i, rawTime: rawTime ?? '', x, bands: [] };
      mapping.bands.forEach((m, b) => {
        const y = m.rate >= 0 ? parseNumber(row[m.rate]) : null;
        const error = m.error >= 0 ? parseNumber(row[m.error]) : null;
        mapped.bands.push({ y, error, hasErrorColumn: m.error >= 0, rawY: m.rate >= 0 ? row[m.rate] : '' });
      });
      result.push(mapped);
    });
    return result;
  }
  function getSelectedBandRows() {
    if (!state.data) return [];
    const mapped = extractMappedRows();
    return BAND_DEFS.map((band, i) => {
      const points = mapped.filter(r => Number.isFinite(r.x) && Number.isFinite(r.bands[i].y)).map(r => ({ x: r.x, y: r.bands[i].y, error: r.bands[i].error, rawTime: r.rawTime, rowIndex: r.rowIndex }));
      return { name: band.label, key: band.key, points, hasErrorColumn: state.mapping.bands[i].error !== '' };
    });
  }
  function renderPreview() {
    const table = $('#labPreviewTable'); table.replaceChildren();
    if (!state.data) return;
    const thead = document.createElement('thead'), hr = document.createElement('tr');
    state.headers.forEach(h => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = h; hr.append(th); }); thead.append(hr);
    const tbody = document.createElement('tbody');
    state.parsedRows.slice(0, 8).forEach(row => { const tr = document.createElement('tr'); row.forEach(v => { const td = document.createElement('td'); td.textContent = v === '' ? '—' : String(v); if (v === '') td.className = 'lab-cell-na'; tr.append(td); }); tbody.append(tr); });
    table.append(thead, tbody); $('#labPreviewCaption').textContent = `Prévia das primeiras ${Math.min(8, state.parsedRows.length)} linhas de ${state.parsedRows.length.toLocaleString('pt-BR')}. Os dados originais não são modificados.`;
  }
  function renderDiagnostics(results) {
    const mapped = state.data ? extractMappedRows() : [];
    const times = mapped.map(r => r.x).filter(Number.isFinite);
    const diags = window.BlazarResearchCore.timeSeriesDiagnostics(times);
    const enabled = getSelectedBandRows().filter(b => b.points.length > 0);
    const validCount = mapped.length;
    const tiles = [
      ['Linhas', validCount.toLocaleString('pt-BR'), 'linhas presentes no arquivo'],
      ['Pontos com tempo válido', times.length.toLocaleString('pt-BR'), `${Math.max(0, validCount - times.length)} sem tempo interpretável`],
      ['Tempos repetidos', diags.duplicateCount.toLocaleString('pt-BR'), 'não removidos automaticamente'],
      ['Inversões temporais', diags.orderReversals.toLocaleString('pt-BR'), 'a ordenação usada no cálculo é registrada']
    ];
    const host = $('#labDiagnostics'); host.replaceChildren();
    tiles.forEach(([label, value, detail]) => { const d = document.createElement('div'); d.className = 'lab-diagnostic'; const s = document.createElement('span'); s.textContent = label; const strong = document.createElement('strong'); strong.textContent = value; const small = document.createElement('small'); small.textContent = detail; d.append(s, strong, small); host.append(d); });
    const summary = $('#labCadenceSummary');
    const mappedRateColumns = state.mapping.bands.map(m => m.rate).filter(v => v !== '' && v != null);
    const duplicateRateColumns = mappedRateColumns.filter((v, i) => mappedRateColumns.indexOf(v) !== i);
    const repeatedMappingNote = duplicateRateColumns.length ? ` Atenção: ${duplicateRateColumns.length} mapeamento(s) reutilizam uma coluna de fluxo já atribuída; confirme que isso é intencional.` : '';
    summary.textContent = state.data ? `Cadência mediana: ${Number.isFinite(diags.medianCadence) ? diags.medianCadence.toLocaleString('pt-BR', { maximumFractionDigits: 6 }) : 'indisponível'}; lacunas heurísticas (> 3 × cadência mediana): ${diags.gapCount}. Bandas com dados mapeados: ${enabled.length}/8.${repeatedMappingNote}` : 'Carregue um arquivo para verificar os dados temporais.';
    if (diags.duplicateCount || diags.orderReversals || diags.gapCount || duplicateRateColumns.length) summary.classList.add('lab-warning-text'); else summary.classList.remove('lab-warning-text');
    const perBand = $('#labBandSummary');
    if (perBand && state.data) {
      perBand.replaceChildren();
      const timeChip = document.createElement('span'); timeChip.className = 'lab-chip';
      timeChip.textContent = `Tempo: ${state.mapping.time === '__row_index__' ? 'índice da observação (sem timestamp)' : (state.headers[Number(state.mapping.time)] || 'coluna temporal')}`; perBand.append(timeChip);
      getSelectedBandRows().forEach(b => { const chip = document.createElement('span'); chip.className = 'lab-chip'; const errorCount = b.points.filter(p => Number.isFinite(p.error) && p.error >= 0).length; chip.textContent = `${b.name}: ${b.points.length}/${state.parsedRows.length}${b.hasErrorColumn ? ` · erro ${errorCount}` : ' · sem erro'}`; perBand.append(chip); });
    }
  }
  function createSvg(host, label, width = 800, height = 260) {
    host.replaceChildren(); const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    host.append(svg); return svg;
  }
  function svgEl(tag, attrs = {}, text = null) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    if (text != null) el.textContent = String(text); return el;
  }
  function plotColors() { return ['var(--teal)', 'var(--purple)', 'var(--amber)', '#60a5fa', '#e879f9', '#34d399', '#fb7185', '#a3e635']; }
  function addText(svg, x, y, text, anchor = 'middle', cls = 'lab-chart-label') { svg.append(svgEl('text', { x, y, 'text-anchor': anchor, class: cls }, text)); }
  function formatValue(n, digits = 3) {
    if (!Number.isFinite(n)) return '—';
    if (n === 0) return '0';
    const abs = Math.abs(n);
    // Preserve nonzero small/large quantities; never make a scientific value look like zero.
    if (abs < 1e-3 || abs >= 1e4) return n.toExponential(Math.min(3, Math.max(1, digits))).replace('.', ',').replace('e-', 'e−').replace('e+', 'e');
    return n.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  }
  function finiteExtent(vals, pad = 0.08) {
    const valid = vals.filter(Number.isFinite); if (!valid.length) return [0, 1]; let min = Math.min(...valid), max = Math.max(...valid); if (min === max) { const extra = Math.abs(min || 1) * .1; min -= extra; max += extra; } const d = max - min; return [min - d * pad, max + d * pad];
  }
  function drawLineChart(host, series, opts = {}) {
    if (!series.some(s => s.points?.some(p => Number.isFinite(p.x) && Number.isFinite(p.y)))) { host.innerHTML = '<div class="lab-chart-placeholder">Ainda não há pontos válidos para desenhar este gráfico.</div>'; return; }
    const width = Math.max(360, Math.min(800, host.clientWidth || 800)), height = opts.height || 270, left = Math.min(62, width * .15), right = 12, top = 16, legendCols = width < 500 ? 2 : 4, legendRows = opts.legend && series.length > 1 ? Math.ceil(series.length / legendCols) : 0, bottom = opts.legend ? 34 + legendRows * 15 : 48, pw = width - left - right, ph = height - top - bottom;
    const xvals = series.flatMap(s => (s.points || []).map(p => p.x).filter(Number.isFinite)); const yvals = series.flatMap(s => (s.points || []).map(p => p.y).filter(Number.isFinite));
    let [xmin, xmax] = finiteExtent(xvals, .015), [ymin, ymax] = finiteExtent(yvals, .09);
    const sx = x => left + (x - xmin) / (xmax - xmin) * pw, sy = y => top + ph - (y - ymin) / (ymax - ymin) * ph;
    const svg = createSvg(host, opts.label || 'Gráfico científico', width, height);
    for (let i = 0; i <= 4; i++) { const y = top + ph * i / 4; svg.append(svgEl('line', { x1: left, y1: y, x2: left + pw, y2: y, class: 'lab-chart-gridline' })); addText(svg, left - 9, y + 4, formatValue(ymax - (ymax - ymin) * i / 4, 3), 'end'); }
    const xTickCount = width < 500 ? 2 : 4;
    for (let i = 0; i <= xTickCount; i++) { const x = left + pw * i / xTickCount; svg.append(svgEl('line', { x1: x, y1: top, x2: x, y2: top + ph, class: 'lab-chart-gridline' })); addText(svg, x, top + ph + 18, formatValue(xmin + (xmax - xmin) * i / xTickCount, 3)); }
    svg.append(svgEl('line', { x1: left, y1: top + ph, x2: left + pw, y2: top + ph, class: 'lab-chart-axis' }), svgEl('line', { x1: left, y1: top, x2: left, y2: top + ph, class: 'lab-chart-axis' }));
    series.forEach((s, idx) => {
      const points = (s.points || []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).slice().sort((a, b) => a.x - b.x);
      if (!points.length) return;
      if (s.color && opts.bars) {
        const slot = pw / Math.max(1, series.length), x = left + idx * slot + slot * .2, bw = slot * .6, y0 = sy(0);
        const yy = sy(points[0].y); svg.append(svgEl('rect', { x, y: Math.min(yy, y0), width: bw, height: Math.max(1, Math.abs(y0 - yy)), rx: 3, fill: s.color, opacity: .82 }));
        addText(svg, x + bw / 2, top + ph + 18, s.name, 'middle');
        if (Number.isFinite(s.lower) && Number.isFinite(s.upper)) { const cx = x + bw / 2; svg.append(svgEl('line', { x1: cx, x2: cx, y1: sy(s.upper), y2: sy(s.lower), stroke: 'var(--text)', 'stroke-width': 1.4 }), svgEl('line', { x1: cx - 5, x2: cx + 5, y1: sy(s.upper), y2: sy(s.upper), stroke: 'var(--text)', 'stroke-width': 1.4 }), svgEl('line', { x1: cx - 5, x2: cx + 5, y1: sy(s.lower), y2: sy(s.lower), stroke: 'var(--text)', 'stroke-width': 1.4 })); }
      } else {
        const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ');
        svg.append(svgEl('path', { d: path, fill: 'none', stroke: s.color || plotColors()[idx % 8], 'stroke-width': s.width || 2.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: s.opacity || 1 }));
        if (opts.points !== false) points.filter((_, i) => points.length < 100 || i % Math.ceil(points.length / 80) === 0).forEach(p => svg.append(svgEl('circle', { cx: sx(p.x), cy: sy(p.y), r: 2.2, fill: s.color || plotColors()[idx % 8] })));
      }
    });
    if (opts.xLabel) addText(svg, left + pw / 2, height - 7, opts.xLabel, 'middle', 'lab-chart-title-label');
    if (opts.yLabel) { const y = top + ph / 2; const txt = svgEl('text', { x: 14, y, transform: `rotate(-90 14 ${y})`, 'text-anchor': 'middle', class: 'lab-chart-title-label' }, opts.yLabel); svg.append(txt); }
    if (opts.legend && series.length > 1) {
      const slot = pw / legendCols;
      series.forEach((s, i) => {
        if (!s.points?.length) return;
        const col = i % legendCols, row = Math.floor(i / legendCols), x = left + col * slot, y = height - 18 - legendRows * 15 + row * 15;
        svg.append(svgEl('line', { x1: x, y1: y - 4, x2: x + 13, y2: y - 4, stroke: s.color || plotColors()[i % 8], 'stroke-width': 3 }));
        addText(svg, x + 18, y, s.name, 'start');
      });
    }
  }
  function drawBarChart(host, items, opts = {}) {
    const valid = items.filter(item => Number.isFinite(item.value));
    if (!valid.length) { host.innerHTML = '<div class="lab-chart-placeholder">Nenhum resultado definido nesta configuração. Consulte os motivos na tabela.</div>'; return; }
    const width = Math.max(360, Math.min(800, host.clientWidth || 800)), height = opts.height || 270, left = Math.min(60, width * .15), right = 12, top = 20, bottom = 56, pw = width - left - right, ph = height - top - bottom;
    const yvalues = valid.flatMap(v => [v.value, Number.isFinite(v.lower) ? v.lower : v.value, Number.isFinite(v.upper) ? v.upper : v.value]); let [ymin, ymax] = finiteExtent(yvalues, .1); if (ymin > 0) ymin = 0;
    const sy = v => top + ph - (v - ymin) / (ymax - ymin) * ph, slot = pw / valid.length, bw = Math.min(38, slot * .56); const svg = createSvg(host, opts.label || 'Gráfico de barras', width, height);
    for (let i = 0; i <= 4; i++) { const value = ymax - (ymax - ymin) * i / 4, y = sy(value); svg.append(svgEl('line', { x1: left, y1: y, x2: left + pw, y2: y, class: 'lab-chart-gridline' })); addText(svg, left - 8, y + 4, formatValue(value, 3), 'end'); }
    valid.forEach((item, i) => { const x = left + slot * i + (slot - bw) / 2, y = sy(item.value), y0 = sy(0); const bar = svgEl('rect', { x, y: Math.min(y, y0), width: bw, height: Math.max(1, Math.abs(y0 - y)), rx: 3, fill: item.color || plotColors()[i % 8], opacity: .86 }); bar.append(svgEl('title', {}, `${item.label}: ${formatValue(item.value, 5)}`)); svg.append(bar);
      if (Number.isFinite(item.lower) && Number.isFinite(item.upper)) { const cx = x + bw / 2; svg.append(svgEl('line', { x1: cx, x2: cx, y1: sy(item.upper), y2: sy(item.lower), stroke: 'var(--text)', 'stroke-width': 1.5 }), svgEl('line', { x1: cx - 4, x2: cx + 4, y1: sy(item.upper), y2: sy(item.upper), stroke: 'var(--text)', 'stroke-width': 1.5 }), svgEl('line', { x1: cx - 4, x2: cx + 4, y1: sy(item.lower), y2: sy(item.lower), stroke: 'var(--text)', 'stroke-width': 1.5 })); }
      const tickLabel = width < 500 ? item.label.replace(/\s*keV/i, '') : item.label;
      addText(svg, x + bw / 2, top + ph + 17, tickLabel, 'middle');
      if (width >= 500) addText(svg, x + bw / 2, Math.max(top + 11, y - 6), formatValue(item.value, 3), 'middle', 'lab-chart-title-label'); });
    if (opts.yLabel) { const y = top + ph / 2; svg.append(svgEl('text', { x: 13, y, transform: `rotate(-90 13 ${y})`, 'text-anchor': 'middle', class: 'lab-chart-title-label' }, opts.yLabel)); }
  }
  function refreshPreviewChart() {
    if (!state.data) return;
    const all = getSelectedBandRows(), idx = Number($('#labPreviewBand').value || 0), selected = all[idx];
    const overlay = $('#labOverlayBands').checked; state.previewBand = idx; state.previewOverlay = overlay;
    const use = overlay ? all.filter(b => b.points.length).map((b, i) => {
      const vals = b.points.map(p => p.y), avg = vals.reduce((a, v) => a + v, 0) / (vals.length || 1), sd = Math.sqrt(vals.reduce((a, v) => a + (v - avg) ** 2, 0) / (vals.length || 1));
      return { name: b.name, color: plotColors()[i], points: b.points.map(p => ({ x: p.x, y: sd > 0 ? (p.y - avg) / sd : 0 })) };
    }) : [{ name: selected?.name || 'Banda', color: plotColors()[idx], points: selected?.points || [] }];
    const xLabel = state.mapping.time === '__row_index__' ? 'Índice da observação (ordem do arquivo)' : (state.headers[Number(state.mapping.time)] || 'Tempo');
    drawLineChart($('#labPreviewChart'), use, { label: overlay ? 'Curvas normalizadas das bandas disponíveis' : `Curva de luz da banda ${selected?.name || idx + 1}`, xLabel, yLabel: overlay ? 'Fluxo (z-score)' : 'Taxa / fluxo', legend: overlay, points: true, height: 250 });
    $('#labPreviewChartNote').textContent = overlay ? 'Cada banda foi normalizada separadamente para média 0 e desvio-padrão 1 apenas neste gráfico de comparação; as métricas usam os valores mapeados originais.' : 'Visualização dos pontos mapeados, antes do cálculo. Nenhum ponto é descartado silenciosamente: consulte os avisos de qualidade.';
  }
  function renderResultsEmpty() {
    ['#labSampenChart', '#labFisherChart', '#labWpeChart', '#labCiChart'].forEach(sel => { const host = $(sel); if (host) host.innerHTML = '<div class="lab-chart-placeholder">Calcule as bandas para preencher esta visualização.</div>'; });
    $('#labResultsTable').replaceChildren();
  }
  function renderResults(results) {
    state.results = results; $('#lab-results-area').hidden = false;
    const sampenItems = results.map((r, i) => ({ label: BAND_DEFS[i].label, value: r?.sampen?.value, lower: r?.sampen?.ci95?.lower, upper: r?.sampen?.ci95?.upper, color: plotColors()[i] }));
    drawBarChart($('#labSampenChart'), sampenItems, { label: 'Sample Entropy calculada por banda com intervalos aproximados quando estimáveis', yLabel: 'Sample Entropy' });
    const fisher = results.filter((r, i) => Number.isFinite(r?.fisherShannon?.H) && Number.isFinite(r?.fisherShannon?.fisher)).map((r, i) => ({ name: BAND_DEFS[results.indexOf(r)].label, color: plotColors()[results.indexOf(r)], points: [{ x: r.fisherShannon.H, y: r.fisherShannon.fisher }] }));
    drawLineChart($('#labFisherChart'), fisher, { label: 'Diagrama Fisher Shannon estimado por banda usando KDE gaussiana; leitura experimental', xLabel: 'Entropia diferencial H (KDE)', yLabel: 'Informação de Fisher (KDE)', legend: true, points: true, height: 310 });
    const wpeSeries = results.map((r, i) => ({ name: BAND_DEFS[i].label, color: plotColors()[i], points: (r?.mseWpe?.points || []).filter(p => Number.isFinite(p.value)).map(p => ({ x: p.scale, y: p.value })) }));
    drawLineChart($('#labWpeChart'), wpeSeries, { label: 'Entropia de permutação ponderada por escala, estimada por banda', xLabel: 'Escala de coarse-graining', yLabel: 'WPE (nats)', legend: true, points: true, height: 300 });
    drawBarChart($('#labCiChart'), results.map((r, i) => ({ label: BAND_DEFS[i].label, value: r?.mseWpe?.CI, color: plotColors()[i] })), { label: 'Complexity Index definido como soma de oito escalas válidas', yLabel: 'CI (soma WPE)' });
    renderResultsTable(results);
    renderResultSummary(results);
    $('#labExportCsvBtn').disabled = false; $('#labExportJsonBtn').disabled = false;
  }
  function statusLabel(status, reason) { const map = { OK: 'OK', ok: 'OK', incomplete: 'Incompleto', insufficient: 'Dados insuficientes', 'zero-weight': 'Peso total zero', insufficient_or_constant: 'Insuficiente/constante', density_not_estimable: 'Densidade não estimável', nonfinite: 'Não finito', not_estimable: 'Não estimável', boundary_probability: 'Limite de probabilidade', open_upper: 'Limite aberto', missing_error_column: 'Sem coluna de erro', insufficient_paired_data: 'Pares insuficientes', nonpositive_mean: 'Média ≤ 0', negative_intrinsic_variance: 'Variância intrínseca negativa', nonfinite_variance: 'Variância não finita', partial_uncertainties: 'Incertezas parciais', zero_intrinsic_variance: 'Variância intrínseca zero' }; return `${map[status] || status || 'Não calculado'}${reason && !['OK', 'ok'].includes(status) ? ` — ${reason}` : ''}`; }
  function renderResultsTable(results) {
    const table = $('#labResultsTable'); table.replaceChildren();
    const headers = ['Banda', 'N', 'SampEn', 'A', 'B', 'IC 95% aprox.', 'm_int (%)', 'H (KDE)', 'I_F (KDE)', 'N_X', 'N_X·I_F', 'CI', 'Estado'];
    const thead = document.createElement('thead'), tr = document.createElement('tr'); headers.forEach(h => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = h; tr.append(th); }); thead.append(tr);
    const tbody = document.createElement('tbody');
    results.forEach((r, i) => {
      const se = r?.sampen || {}, ci = se.ci95 || {}, fs = r?.fisherShannon || {}, mod = r?.modulation || {}, mse = r?.mseWpe || {};
      const vals = [BAND_DEFS[i].label, r?.n ?? '—', formatValue(se.value), se.A ?? '—', se.B ?? '—', Number.isFinite(ci.lower) || Number.isFinite(ci.upper) ? `${formatValue(ci.lower)} – ${formatValue(ci.upper)}` : 'não estimável', formatValue(mod.value), formatValue(fs.H), formatValue(fs.fisher), formatValue(fs.entropyPower), formatValue(fs.product), formatValue(mse.CI), statusLabel(se.reason === 'OK' ? 'OK' : se.ci95?.status, se.reason !== 'OK' ? se.reason : '')];
      const row = document.createElement('tr'); vals.forEach(v => { const td = document.createElement('td'); td.textContent = v; row.append(td); }); tbody.append(row);
    });
    table.append(thead, tbody);
  }
  function renderResultSummary(results) {
    const success = results.filter(r => Number.isFinite(r?.sampen?.value)).length;
    const modCount = results.filter(r => Number.isFinite(r?.modulation?.value)).length;
    const ciCount = results.filter(r => Number.isFinite(r?.mseWpe?.CI)).length;
    $('#labResultSummary').textContent = `Calculadas ${results.filter(r => r && r.n > 0).length} banda(s) com pontos válidos. Sample Entropy definida em ${success}/8; modulação intrínseca estimável em ${modCount}/8; CI completo em ${ciCount}/8. Valores não estimáveis aparecem como “—”, nunca como zero.`;
  }
  function cancelWorker() { if (state.worker) { state.worker.terminate(); state.worker = null; } state.jobId++; state.busy = false; $('#labCalcBtn').disabled = !state.data; $('#labCancelBtn').disabled = true; hideProgress(); }
  async function runAnalysis() {
    if (!state.data || state.busy) return;
    const m = Number($('#labM').value), rFactor = Number($('#labR').value);
    if (!Number.isInteger(m) || m < 1 || m > 5) { setStatus('m_SE precisa ser um inteiro entre 1 e 5.', 'error'); return; }
    if (!Number.isFinite(rFactor) || rFactor <= 0 || rFactor > 2) { setStatus('r/σ precisa estar entre maior que 0 e 2.', 'error'); return; }
    const bands = getSelectedBandRows().map((b, i) => ({ ...b, index: i }));
    if (!bands.some(b => b.points.length >= 4)) { setStatus('Mapeie pelo menos uma coluna de taxa/fluxo com quatro ou mais pontos e uma coluna temporal válida.', 'error'); return; }
    if (state.parsedRows.length > MAX_ROWS_WARN && !window.confirm(`O arquivo contém ${state.parsedRows.length.toLocaleString('pt-BR')} linhas. O cálculo pode consumir bastante memória/CPU. Continuar?`)) return;
    cancelWorker(); state.jobId += 1; const jobId = state.jobId; state.busy = true;
    $('#labCalcBtn').disabled = true; $('#labCancelBtn').disabled = false; $('#labExportCsvBtn').disabled = true; $('#labExportJsonBtn').disabled = true;
    setProgress(0, bands.length, 'Iniciando cálculo por banda…'); setStatus('Calculando localmente no navegador. Nenhum arquivo foi enviado a um servidor.', 'info');
    const options = { m, rFactor };
    let worker = null;
    try { worker = new Worker(new URL('lab-analysis-worker.js', document.baseURI)); state.worker = worker; } catch (_) { worker = null; }
    if (worker) {
      worker.onmessage = event => {
        const data = event.data || {}; if (data.jobId !== jobId) return;
        if (data.type === 'progress') setProgress(data.current, data.total, `Calculando ${data.bandName}…`);
        if (data.type === 'complete') {
          worker.terminate(); state.worker = null; state.busy = false; $('#labCalcBtn').disabled = false; $('#labCancelBtn').disabled = true; setProgress(bands.length, bands.length, 'Cálculos concluídos');
          const byIndex = Array(8).fill(null); data.results.forEach(item => { if (!item.skipped) byIndex[item.index] = item.result; });
          completeAnalysis(byIndex, options);
        }
        if (data.type === 'error') { worker.terminate(); state.worker = null; state.busy = false; $('#labCalcBtn').disabled = false; $('#labCancelBtn').disabled = true; hideProgress(); setStatus(`Falha no cálculo: ${data.message}`, 'error'); }
      };
      worker.onerror = () => { worker.terminate(); state.worker = null; state.busy = false; $('#labCalcBtn').disabled = false; $('#labCancelBtn').disabled = true; hideProgress(); setStatus('O trabalhador de cálculo falhou. Recarregue a página ou tente com um arquivo menor.', 'error'); };
      worker.postMessage({ type: 'analyze', jobId, bands, options });
    } else {
      const results = Array(8).fill(null);
      for (let i = 0; i < bands.length; i++) {
        if (!state.busy || state.jobId !== jobId) return;
        if (bands[i].points.length >= 4) results[i] = window.BlazarResearchCore.analyzeBand(bands[i].points, { m, rFactor, hasErrorColumn: bands[i].hasErrorColumn });
        setProgress(i + 1, bands.length, `Calculando ${bands[i].name}…`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (!state.busy || state.jobId !== jobId) return;
      state.busy = false; $('#labCalcBtn').disabled = false; $('#labCancelBtn').disabled = true; setProgress(bands.length, bands.length, 'Cálculos concluídos'); completeAnalysis(results, options);
    }
  }
  function completeAnalysis(results, options) {
    state.results = results; state.analysisOptions = options; renderResults(results); renderDiagnostics(results);
    const valid = results.filter(r => r && r.n > 0).length;
    setStatus(`Análise concluída para ${valid} banda(s) com dados válidos. Verifique os diagnósticos e os estados de cada métrica antes de interpretar os resultados.`, 'success');
    $('#lab-results-area').hidden = false; $('#labResultsHeading').focus({ preventScroll: true }); $('#lab-results-area').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function reportMeta() {
    const mapping = selectedColumns();
    return { app: 'BlazarLab privado', version: VERSION, analysisCore: window.BlazarResearchCore.VERSION, createdAt: new Date().toISOString(), fileName: state.file?.name || 'demonstração-sintética.csv', fileBytes: state.rawBuffer?.byteLength ?? state.file?.size ?? null, synthetic: state.synthetic, rowCount: state.parsedRows.length, columns: state.headers, mapping: { time: mapping.time === '__row_index__' ? 'Índice da observação (sem timestamp)' : (state.headers[mapping.time] || null), bands: mapping.bands.map((m, i) => ({ band: BAND_DEFS[i].label, rate: m.rate >= 0 ? state.headers[m.rate] : null, error: m.error >= 0 ? state.headers[m.error] : null })) }, options: state.analysisOptions || { m: Number($('#labM').value), rFactor: Number($('#labR').value) }, note: 'Relatório de resultados e proveniência mínima. O conteúdo bruto do arquivo não é incluído automaticamente.', validationStatus: 'Experimental: requer comparação numérica independente antes de resultados serem tratados como validados.' };
  }
  function exportCsv() {
    if (!state.results) return;
    const headers = ['app_version', 'source_file', 'synthetic_data', 'band', 'N', 'm_SE', 'r_over_sigma', 'sigma', 'r_absolute', 'SampEn', 'A_matches_m_plus_1', 'B_matches_m', 'SampEn_CI95_lower_approx', 'SampEn_CI95_upper_approx', 'SampEn_CI95_status', 'm_int_percent', 'm_int_status', 'm_int_n_used', 'H_differential_KDE', 'Fisher_information_KDE', 'entropy_power_NX', 'NX_times_IF', ...Array.from({ length: 8 }, (_, i) => `WPE_scale_${i + 1}`), 'CI_sum_WPE_8_scales', 'CI_status', 'time_duplicates', 'time_order_reversals', 'time_gap_count', 'validation_note'];
    const mapped = getSelectedBandRows();
    const rows = state.results.map((r, i) => {
      const se = r?.sampen || {}, mod = r?.modulation || {}, fs = r?.fisherShannon || {}, mse = r?.mseWpe || {}, diag = r?.timeDiagnostics || {};
      const vals = [VERSION, state.file?.name || 'demonstração-sintética.csv', state.synthetic ? 'SINTÉTICO' : 'REAL/USUÁRIO', BAND_DEFS[i].label, r?.n ?? '', state.analysisOptions?.m ?? '', state.analysisOptions?.rFactor ?? '', se.sigma ?? '', se.r ?? '', se.value ?? '', se.A ?? '', se.B ?? '', se.ci95?.lower ?? '', se.ci95?.upper ?? '', se.ci95?.status ?? '', mod.value ?? '', mod.status ?? '', mod.nUsed ?? '', fs.H ?? '', fs.fisher ?? '', fs.entropyPower ?? '', fs.product ?? '', ...(mse.points || []).map(p => p.value ?? ''), ...Array(Math.max(0, 8 - (mse.points || []).length)).fill(''), mse.CI ?? '', mse.status ?? '', diag.duplicateCount ?? '', diag.orderReversals ?? '', diag.gapCount ?? '', 'Experimental; validar contra implementação independente'];
      return vals;
    });
    const csvCell = v => { const s = v == null ? '' : String(v); return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n');
    downloadBlob(`BlazarLab_13.02_resultados${state.synthetic ? '_SINTETICO' : ''}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  }
  function exportJson() {
    if (!state.results) return;
    const results = state.results.map((r, i) => r ? ({ band: BAND_DEFS[i].label, ...r }) : ({ band: BAND_DEFS[i].label, status: 'no_valid_points' }));
    const report = { ...reportMeta(), results, warning: 'Métodos experimentais. IC95 de SampEn é aproximado e não corrigido para dependência entre padrões. Fisher–Shannon (KDE) e WPE/CI requerem validação externa.' };
    downloadBlob(`BlazarLab_13.02_relatorio${state.synthetic ? '_SINTETICO' : ''}.json`, new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' }));
  }
  function resetLab() {
    cancelWorker(); state.data = null; state.file = null; state.rawBuffer = null; state.parsedRows = []; state.headers = []; state.mapping = { time: '', bands: [] }; state.synthetic = false; state.results = null; state.parseWarnings = [];
    $('#labFileInput').value = ''; $('#labFileMeta').hidden = true; $('#lab-preview-area').hidden = true; $('#lab-config-area').hidden = true; $('#lab-results-area').hidden = true;
    $('#labCalcBtn').disabled = true; $('#labResetBtn').disabled = true; $('#labExportCsvBtn').disabled = true; $('#labExportJsonBtn').disabled = true; $('#labCancelBtn').disabled = true; hideProgress(); renderResultsEmpty(); setStatus('Arquivo removido da sessão. Nada foi enviado a um servidor.', 'info'); $('#labFileName').textContent = 'Nenhum arquivo';
  }
  async function handleFile(file) {
    if (!file) return;
    try {
      setStatus(`Lendo ${file.name} localmente…`, 'info'); $('#labCalcBtn').disabled = true;
      const parsed = await parseFile(file); initFromParsed(parsed);
      if (parsed.fits) setStatus(`FITS BINTABLE lido localmente: ${parsed.rows.length.toLocaleString('pt-BR')} linhas, ${parsed.headers.length} colunas. Verifique o mapeamento e as unidades antes de calcular.`, 'success');
    } catch (err) {
      $('#labFileInput').value = '';
      const previousDataKept = Boolean(state.data);
      setStatus(`${err?.message || 'Não foi possível ler o arquivo.'}${previousDataKept ? ' Os dados carregados anteriormente foram mantidos; remova-os se não quiser continuar com eles.' : ''}`, 'error');
    }
  }
  function loadSyntheticDemo() {
    state.file = null;
    const headers = ['TIME_MJD', ...BAND_DEFS.flatMap(b => [`RATE_${b.key}`, `ERROR_${b.key}`])];
    const rows = [];
    let time = 59000;
    for (let i = 0; i < 180; i++) {
      if (i > 0) time += 0.55 + 0.08 * Math.sin(i * .19);
      const t = time;
      const row = [t.toFixed(5)];
      BAND_DEFS.forEach((band, j) => {
        const base = .019 + j * .004, modulation = .004 + j * .0005;
        const noise = .48 * Math.sin(i * (0.173 + j * 0.007) + j * .8) + .22 * Math.sin(i * .521 + j * 1.4) + .14 * Math.cos(i * .091 + j * .5);
        const y = Math.max(.0002, base + modulation * (Math.sin(i * .047 + j * .45) + noise));
        const err = base * (.06 + .012 * j) * (1 + .12 * Math.abs(Math.sin(i * .31 + j)));
        row.push(y.toFixed(7), err.toFixed(7));
      });
      rows.push(row);
    }
    state.rawBuffer = new TextEncoder().encode([headers.join(','), ...rows.map(r => r.join(','))].join('\n')).buffer;
    initFromParsed({ headers, rows, delimiter: ',', headerless: false, warnings: [] }, { synthetic: true });
    setStatus('Demonstração sintética carregada: 180 tempos × 8 bandas. Use para testar o fluxo da interface; não são observações reais.', 'success');
  }
  function saveSyntheticCsv() {
    const headers = ['TIME_MJD', ...BAND_DEFS.flatMap(b => [`RATE_${b.key}`, `ERROR_${b.key}`])]; const rows = [];
    let time = 59000;
    for (let i = 0; i < 180; i++) { if (i > 0) time += 0.55 + 0.08 * Math.sin(i * .19); const t = time; const row = [t.toFixed(5)]; BAND_DEFS.forEach((b, j) => { const base = .019 + j * .004, modulation = .004 + j * .0005; const noise = .48 * Math.sin(i * (0.173 + j * .007) + j * .8) + .22 * Math.sin(i * .521 + j * 1.4) + .14 * Math.cos(i * .091 + j * .5); const y = Math.max(.0002, base + modulation * (Math.sin(i * .047 + j * .45) + noise)); const err = base * (.06 + .012 * j) * (1 + .12 * Math.abs(Math.sin(i * .31 + j))); row.push(y.toFixed(7), err.toFixed(7)); }); rows.push(row); }
    downloadBlob('BlazarLab_13.02_exemplo_SINTETICO.csv', new Blob(['\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  }
  function bindUI() {
    $('#labFileInput').addEventListener('change', e => handleFile(e.target.files?.[0]));
    const drop = $('#labDropzone');
    ['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, e => { e.preventDefault(); drop.classList.add('is-dragover'); }));
    ['dragleave', 'drop'].forEach(type => drop.addEventListener(type, e => { e.preventDefault(); drop.classList.remove('is-dragover'); }));
    drop.addEventListener('drop', e => handleFile(e.dataTransfer?.files?.[0]));
    $('#labDemoBtn').addEventListener('click', loadSyntheticDemo); $('#labExampleCsvBtn').addEventListener('click', saveSyntheticCsv);
    $('#labCalcBtn').addEventListener('click', runAnalysis); $('#labCancelBtn').addEventListener('click', () => { cancelWorker(); setStatus('Cálculo cancelado. Os dados carregados foram mantidos.', 'info'); });
    $('#labResetBtn').addEventListener('click', resetLab); $('#labExportCsvBtn').addEventListener('click', exportCsv); $('#labExportJsonBtn').addEventListener('click', exportJson);
    $('#labPreviewBand').addEventListener('change', refreshPreviewChart); $('#labOverlayBands').addEventListener('change', refreshPreviewChart);
    $('#labTimeColumn').addEventListener('change', e => { state.mapping.time = e.target.value === '__row_index__' ? '__row_index__' : e.target.value; invalidateResults(); updateCalculateAvailability(); refreshPreviewChart(); renderDiagnostics(null); });
    ['#labM', '#labR'].forEach(selector => $(selector).addEventListener('change', () => invalidateResults('Os parâmetros foram alterados. Recalcule para gerar resultados com a nova configuração.')));
    $('#labDropzone').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#labFileInput').click(); } });
    $('#labDownloadSource').addEventListener('click', () => { setStatus('Os arquivos importados são processados em memória nesta aba. Nada é carregado para um servidor; o relatório exportado não inclui os dados brutos por padrão.', 'info'); });
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.data) refreshPreviewChart();
        if (state.results && !state.busy) renderResults(state.results);
      }, 140);
    }, { passive: true });
  }
  function enhanceLocalNotice() {
    const notice = $('#labPrivateNotice'); if (!notice) return;
    if (location.protocol === 'file:') {
      notice.setAttribute('data-local-open', 'true');
      const p = $('p', notice); if (p) p.textContent = 'Esta versão funciona no navegador. Alguns navegadores bloqueiam Web Workers ao abrir um arquivo HTML diretamente por file://; nesses casos, o cálculo usa um fallback local. Não existe envio de dados ao servidor.';
    }
  }
  function boot() { bindUI(); enhanceLocalNotice(); resetLab(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
