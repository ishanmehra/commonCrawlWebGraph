#!/usr/bin/env node
import { access, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import duckdb from 'duckdb';

const argv = process.argv.slice(2);
const domain = argv[0] ?? 'example.com';
const topN = Number.parseInt(argv[1] ?? '100', 10);
const release = process.env.CC_RELEASE ?? 'cc-main-2026-jan-feb-mar';
const threads = Number.parseInt(process.env.CC_THREADS ?? '', 10);
const cacheDir = `${process.env.HOME ?? process.env.USERPROFILE ?? tmpdir()}/.cache/cc-backlinks/${release}`;
const baseUrl = `https://data.commoncrawl.org/projects/hyperlinkgraph/${release}/domain`;
const verticesPath = `${cacheDir}/domain-vertices.txt.gz`;
const edgesPath = `${cacheDir}/domain-edges.txt.gz`;

const log = (message) => process.stderr.write(`${message}\n`);
const fail = (message) => {
  throw new Error(message);
};

const reverseDomain = (value) => value.split('.').reverse().join('.');
const duckdbSqlEscape = (value) => value.replaceAll("'", "''");
const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

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
    await pipeline(response.body, createWriteStream(tempPath));
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
  if (!domain || domain.includes(' ')) {
    fail('domain must be a single hostname such as example.com');
  }

  if (!Number.isFinite(topN) || !isPositiveInteger(topN)) {
    fail('top_n must be a positive integer');
  }

  log(`>> domain:   ${domain}  (reversed: ${reverseDomain(domain)})`);
  log(`>> release:  ${release}`);
  log(`>> cache:    ${cacheDir}`);

  await download(`${baseUrl}/${release}-domain-vertices.txt.gz`, verticesPath);
  await download(`${baseUrl}/${release}-domain-edges.txt.gz`, edgesPath);

  if (Number.isFinite(threads) && isPositiveInteger(threads)) {
    await runDuckDB(`PRAGMA threads=${threads};`);
  }

  const escapedDomain = duckdbSqlEscape(reverseDomain(domain));
  log('>> checking domain exists in vertices ...');

  const vertexCountRows = await runDuckDB(`
SELECT COUNT(*) AS vertex_count
FROM read_csv('${verticesPath.replaceAll('\\', '/')}', delim='\t', header=false, columns={'id':'BIGINT','rev_domain':'VARCHAR','num_hosts':'BIGINT'})
WHERE rev_domain = '${escapedDomain}';
`);
  const vertexCount = Number.parseInt(vertexCountRows[0]?.vertex_count ?? '0', 10);

  if (vertexCount === 0) {
    fail(`'${domain}' not found in the ${release} vertex file`);
  }

  log(`>> querying backlinks for ${domain} ...`);
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
LIMIT ${topN};
`);

  if (resultRows.length === 0) {
    process.stdout.write(`No backlinks found for ${domain}\n`);
    return;
  }

  process.stdout.write('linking_domain,host_count,edge_count\n');
  for (const row of resultRows) {
    process.stdout.write(`${row.linking_domain},${row.host_count},${row.edge_count}\n`);
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
