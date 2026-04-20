#!/usr/bin/env node
import { access, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import duckdb from 'duckdb';

const argv = process.argv.slice(2);
const hasTrailingTopN = argv.length > 0 && /^\d+$/.test(argv[argv.length - 1]);
const hasUnlimitedFlag = argv.length > 0 && /^(all|unlimited|--all)$/i.test(argv[argv.length - 1]);
const topN = hasTrailingTopN ? Number.parseInt(argv[argv.length - 1], 10) : null;
const domains = (hasTrailingTopN || hasUnlimitedFlag ? argv.slice(0, -1) : argv).flatMap((value) => value.split(',').map((entry) => entry.trim()).filter(Boolean));
const requestedDomains = domains.length > 0 ? domains : ['example.com'];
const release = process.env.CC_RELEASE ?? 'cc-main-2026-jan-feb-mar';
const threads = Number.parseInt(process.env.CC_THREADS ?? '', 10);
const cacheDir = `${process.env.HOME ?? process.env.USERPROFILE ?? tmpdir()}/.cache/cc-backlinks/${release}`;
const baseUrl = `https://data.commoncrawl.org/projects/hyperlinkgraph/${release}/domain`;
const verticesPath = `${cacheDir}/domain-vertices.txt.gz`;
const edgesPath = `${cacheDir}/domain-edges.txt.gz`;
const repoRoot = process.cwd();
const reportsDir = join(repoRoot, 'backlink-reports');

const log = (message) => process.stderr.write(`${message}\n`);
const fail = (message) => {
  throw new Error(message);
};

const reverseDomain = (value) => value.split('.').reverse().join('.');
const duckdbSqlEscape = (value) => value.replaceAll("'", "''");
const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;
const formatBytes = (bytes) => {
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};
const formatDateString = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
};
const normalizeDomainCandidates = (value) => {
  const candidates = [value];

  if (value.startsWith('www.')) {
    candidates.push(value.slice(4));
  }

  return [...new Set(candidates)];
};
const sanitizeFileName = (value) => value.replace(/[^a-z0-9.-]+/gi, '_');
const escapeMarkdownCell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const renderMarkdownTable = (rows) => {
  const header = ['linking_domain', 'host_count', 'edge_count'];
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`
  ];

  for (const row of rows) {
    lines.push(`| ${escapeMarkdownCell(row.linking_domain)} | ${escapeMarkdownCell(row.host_count)} | ${escapeMarkdownCell(row.edge_count)} |`);
  }

  return lines.join('\n');
};
const renderReportMarkdown = ({ requestedDomain, matchedDomain, releaseName, queryDate, rows, noMatch }) => {
  const title = `Backlinks for ${requestedDomain}`;
  const sections = [
    `# ${title}`,
    '',
    `- Requested domain: ${requestedDomain}`,
    `- Matched domain: ${matchedDomain ?? 'not found'}`,
    `- Release: ${releaseName}`,
    `- Generated on: ${queryDate}`,
    '',
    noMatch ? 'No backlinks were found for this domain in the selected release.' : renderMarkdownTable(rows)
  ];

  return sections.join('\n');
};

const db = new duckdb.Database(':memory:');
const connection = db.connect();

async function pathExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function writeDomainReport({ requestedDomain, matchedDomain, rows, noMatch, queryDate }) {
  const dateString = formatDateString(queryDate);
  const fileName = `${sanitizeFileName(requestedDomain)}-${dateString}.md`;
  const reportPath = join(reportsDir, fileName);
  const reportMarkdown = renderReportMarkdown({
    requestedDomain,
    matchedDomain,
    releaseName: release,
    queryDate: queryDate.toISOString(),
    rows,
    noMatch
  });

  await ensureDir(reportPath);
  await writeFile(reportPath, `${reportMarkdown}\n`, 'utf8');
  log(`>> wrote report: ${reportPath}`);
}

async function download(url, destination) {
  if (await pathExists(destination)) {
    const fileSize = await stat(destination).then((entry) => entry.size).catch(() => 0);
    log(`>> [skip] ${basename(destination)} already cached (${fileSize} bytes)`);
    return;
  }

  await ensureDir(destination);
  const tempPath = `${destination}.${randomUUID()}.tmp`;
  log(`>> downloading ${basename(destination)} ...`);

  const response = await fetch(url, {
    headers: {
      'user-agent': 'cc-backlinks-cli/1.0'
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`failed to download ${url} (${response.status} ${response.statusText})`);
  }

  try {
    const totalBytes = Number.parseInt(response.headers.get('content-length') ?? '', 10);
    const output = createWriteStream(tempPath);
    const outputClosed = new Promise((resolve, reject) => {
      output.once('finish', resolve);
      output.once('error', reject);
    });
    let downloadedBytes = 0;
    let lastLoggedAt = Date.now();

    try {
      for await (const chunk of response.body) {
        downloadedBytes += chunk.length;
        if (!output.write(chunk)) {
          await new Promise((resolve) => output.once('drain', resolve));
        }

        const now = Date.now();
        if (now - lastLoggedAt >= 1000) {
          lastLoggedAt = now;
          if (Number.isFinite(totalBytes) && totalBytes > 0) {
            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            process.stderr.write(`\r>> downloading ${basename(destination)} ... ${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)} (${percent}%)`);
          } else {
            process.stderr.write(`\r>> downloading ${basename(destination)} ... ${formatBytes(downloadedBytes)} downloaded`);
          }
        }
      }

      output.end();
      await outputClosed;
    } catch (error) {
      output.destroy();
      throw error;
    }

    process.stderr.write(`\r>> downloading ${basename(destination)} ... ${formatBytes(downloadedBytes)} complete\n`);
    await rename(tempPath, destination);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

function runDuckDB(sql) {
  return new Promise((resolve, reject) => {
    connection.all(sql, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows ?? []);
    });
  });
}

function closeConnection() {
  connection.close?.();
}

async function main() {
  const queryDate = new Date();

  if (topN !== null && (!Number.isFinite(topN) || !isPositiveInteger(topN))) {
    fail('top_n must be a positive integer');
  }

  for (const domain of requestedDomains) {
    if (!domain || domain.includes(' ')) {
      fail('each domain must be a single hostname such as example.com');
    }
  }

  log(`>> domains:  ${requestedDomains.join(', ')}`);
  log(`>> release:  ${release}`);
  log(`>> cache:    ${cacheDir}`);

  await download(`${baseUrl}/${release}-domain-vertices.txt.gz`, verticesPath);
  await download(`${baseUrl}/${release}-domain-edges.txt.gz`, edgesPath);

  if (Number.isFinite(threads) && isPositiveInteger(threads)) {
    await runDuckDB(`PRAGMA threads=${threads};`);
  }

  const limitClause = topN === null ? '' : `\nLIMIT ${topN}`;

  for (const domain of requestedDomains) {
    const candidates = normalizeDomainCandidates(domain);
    let matchedDomain = null;

    log(`>> checking domain exists in vertices: ${domain} ...`);

    for (const candidate of candidates) {
      const escapedCandidate = duckdbSqlEscape(reverseDomain(candidate));
      const vertexCountRows = await runDuckDB(`
SELECT COUNT(*) AS vertex_count
FROM read_csv('${verticesPath.replaceAll('\\', '/')}', delim='\t', header=false, columns={'id':'BIGINT','rev_domain':'VARCHAR','num_hosts':'BIGINT'})
WHERE rev_domain = '${escapedCandidate}';
`);
      const vertexCount = Number.parseInt(vertexCountRows[0]?.vertex_count ?? '0', 10);

      if (vertexCount > 0) {
        matchedDomain = candidate;
        if (candidate !== domain) {
          log(`>> matched apex domain: ${candidate}`);
        }
        break;
      }
    }

    if (!matchedDomain) {
      process.stdout.write(`\n[${domain}] no match found in the ${release} vertex file\n`);
      await writeDomainReport({
        requestedDomain: domain,
        matchedDomain: null,
        rows: [],
        noMatch: true,
        queryDate
      });
      continue;
    }

    const escapedDomain = duckdbSqlEscape(reverseDomain(matchedDomain));

    log(`>> querying backlinks for ${matchedDomain} ...`);
    log('>> NOTE: first run scans a large gzipped edge file and may take several minutes');

    const resultRows = await runDuckDB(`
WITH vertices AS (
  SELECT *
  FROM read_csv('${verticesPath.replaceAll('\\', '/')}', delim='\t', header=false, columns={'id':'BIGINT','rev_domain':'VARCHAR','num_hosts':'BIGINT'})
),

target AS (
  SELECT id
  FROM vertices
  WHERE rev_domain = '${escapedDomain}'
),

inbound AS (
  SELECT from_id
  FROM read_csv('${edgesPath.replaceAll('\\', '/')}', delim='\t', header=false, columns={'from_id':'BIGINT','to_id':'BIGINT'})
  WHERE to_id IN (SELECT id FROM target)
    AND from_id NOT IN (SELECT id FROM target)
)

SELECT
  array_to_string(list_reverse(string_split(v.rev_domain, '.')), '.') AS linking_domain,
  v.num_hosts AS host_count,
  COUNT(*) AS edge_count
FROM inbound i
JOIN vertices v ON v.id = i.from_id
GROUP BY v.rev_domain, v.num_hosts
ORDER BY v.num_hosts DESC, linking_domain
${limitClause};
`);

    process.stdout.write(`\n[${domain}] results (${matchedDomain})\n`);

    if (resultRows.length === 0) {
      process.stdout.write('No backlinks found\n');
      await writeDomainReport({
        requestedDomain: domain,
        matchedDomain,
        rows: [],
        noMatch: true,
        queryDate
      });
      continue;
    }

    process.stdout.write('linking_domain,host_count,edge_count\n');
    for (const row of resultRows) {
      process.stdout.write(`${row.linking_domain},${row.host_count},${row.edge_count}\n`);
    }

    await writeDomainReport({
      requestedDomain: domain,
      matchedDomain,
      rows: resultRows,
      noMatch: false,
      queryDate
    });
  }
}

main()
  .catch((error) => {
    process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    closeConnection();
  });
