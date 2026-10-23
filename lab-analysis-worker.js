'use strict';
importScripts('lab-analysis-core.js');
let activeJob = 0;
self.onmessage = async (event) => {
  const message = event.data || {};
  if (message.type === 'cancel') { activeJob = Number(message.jobId) || activeJob + 1; return; }
  if (message.type !== 'analyze') return;
  const jobId = Number(message.jobId) || 1;
  activeJob = jobId;
  const bands = Array.isArray(message.bands) ? message.bands : [];
  const options = message.options || {};
  const results = [];
  try {
    for (let index = 0; index < bands.length; index++) {
      if (activeJob !== jobId) return;
      const band = bands[index];
      if (!band || !Array.isArray(band.points) || !band.points.length) {
        results.push({ index, skipped: true, reason: 'Nenhum ponto válido nesta banda.' });
      } else {
        const result = self.BlazarResearchCore.analyzeBand(band.points, {
          m: options.m,
          rFactor: options.rFactor,
          scales: 8,
          wpeDimension: 4,
          hasErrorColumn: Boolean(band.hasErrorColumn)
        });
        results.push({ index, result });
      }
      self.postMessage({ type: 'progress', jobId, current: index + 1, total: bands.length, bandName: band?.name || `Banda ${index + 1}` });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (activeJob === jobId) self.postMessage({ type: 'complete', jobId, results });
  } catch (error) {
    if (activeJob === jobId) self.postMessage({ type: 'error', jobId, message: error?.message || 'Falha no cálculo.' });
  }
};
