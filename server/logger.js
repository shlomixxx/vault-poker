'use strict';

const MAX_LOGS = 600;
const _logs = [];

function _write(level, category, message, data) {
  const ts   = new Date().toISOString();
  const entry = { ts, level, category, message, data: data ?? null };
  _logs.push(entry);
  if (_logs.length > MAX_LOGS) _logs.shift();

  const dataStr = data ? ' ' + JSON.stringify(data) : '';
  const line    = `[${ts}] [${level}] [${category}] ${message}${dataStr}`;
  if (level === 'ERROR') console.error(line);
  else                   console.log(line);
}

module.exports = {
  info:    (cat, msg, data) => _write('INFO',  cat, msg, data),
  warn:    (cat, msg, data) => _write('WARN',  cat, msg, data),
  error:   (cat, msg, data) => _write('ERROR', cat, msg, data),
  getLogs: (n = 200)        => _logs.slice(-Math.min(n, MAX_LOGS)),
};
