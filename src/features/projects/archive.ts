/**
 * Leitura defensiva de arquivos compactados. Detecta o formato pelos bytes, impõe
 * limites antes de descompactar (anti zip-bomb), normaliza caminhos e recusa
 * arquivos protegidos por senha com mensagem clara.
 *
 * Nativos (sem dependência): ZIP/.jrec, TAR, GZIP (.tar.gz/.tgz).
 * Via libarchive (WASM, carregado só quando necessário): 7z, RAR, XZ, BZIP2.
 */
import { unzipSync } from 'fflate';

export type ArchiveKind = 'zip' | 'tar' | 'gzip' | '7z' | 'rar' | 'xz' | 'bzip2' | 'json' | 'unknown';

export const LIMITS = {
  /** Arquivo de entrada */
  inputBytes: 1024 * 1024 * 1024,
  /** Número de arquivos dentro do pacote */
  entries: 4000,
  /** Um único arquivo descompactado */
  entryBytes: 400 * 1024 * 1024,
  /** Tudo descompactado */
  totalBytes: 1536 * 1024 * 1024,
  /** Taxa de compressão máxima para entradas grandes (zip-bomb) */
  ratio: 200,
};
export type Limits = typeof LIMITS;

export type ArchiveErrorCode = 'too-big' | 'too-many' | 'bomb' | 'encrypted' | 'corrupt' | 'unsupported' | 'unsafe-path' | 'cancelled';

export class ArchiveError extends Error {
  constructor(public code: ArchiveErrorCode, message: string) {
    super(message);
  }
}

export interface Entry { path: string; data: Uint8Array }

const MB = (n: number) => `${Math.round(n / 1048576)} MB`;

export function detectKind(b: Uint8Array): ArchiveKind {
  const at = (i: number) => b[i] ?? -1;
  if (at(0) === 0x50 && at(1) === 0x4b && (at(2) === 3 || at(2) === 5 || at(2) === 7)) return 'zip';
  if (at(0) === 0x37 && at(1) === 0x7a && at(2) === 0xbc && at(3) === 0xaf && at(4) === 0x27 && at(5) === 0x1c) return '7z';
  if (String.fromCharCode(...b.subarray(0, 6)) === 'Rar!\x1a\x07') return 'rar';
  if (at(0) === 0x1f && at(1) === 0x8b) return 'gzip';
  if (at(0) === 0xfd && String.fromCharCode(...b.subarray(1, 6)) === '7zXZ\0') return 'xz';
  if (String.fromCharCode(...b.subarray(0, 3)) === 'BZh') return 'bzip2';
  if (b.length > 262 && String.fromCharCode(...b.subarray(257, 262)) === 'ustar') return 'tar';
  let i = 0;
  if (at(0) === 0xef && at(1) === 0xbb && at(2) === 0xbf) i = 3;
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x0a || b[i] === 0x0d || b[i] === 0x09)) i++;
  if (b[i] === 0x7b) return 'json';
  return 'unknown';
}

/** Caminho relativo seguro, ou null quando deve ser ignorado/recusado. */
export function safePath(raw: string): string | null {
  const p = raw.replace(/\\/g, '/');
  if (p.startsWith('/') || /^[a-zA-Z]:/.test(p) || p.includes('\0')) return null;
  const parts: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') return null;
    parts.push(seg);
  }
  if (parts.length === 0) return null;
  // Lixo de sistemas operacionais não faz parte do projeto.
  if (parts[0] === '__MACOSX' || parts.at(-1) === '.DS_Store' || parts.at(-1) === 'Thumbs.db') return null;
  return parts.join('/');
}

interface ZipInfo { name: string; flags: number; method: number; compSize: number; size: number }

/** Lê o diretório central do ZIP sem descompactar nada. */
export function readZipDirectory(b: Uint8Array): ZipInfo[] {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ArchiveError('corrupt', 'O arquivo ZIP está incompleto ou corrompido.');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  if (count === 0xffff || off === 0xffffffff) throw new ArchiveError('unsupported', 'ZIP64 não é suportado para projetos. Use um pacote menor.');
  const out: ZipInfo[] = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (off + 46 > b.length || dv.getUint32(off, true) !== 0x02014b50) throw new ArchiveError('corrupt', 'O diretório do ZIP está corrompido.');
    const flags = dv.getUint16(off + 8, true);
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const size = dv.getUint32(off + 24, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const name = dec.decode(b.subarray(off + 46, off + 46 + nameLen));
    out.push({ name, flags, method, compSize, size });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Valida tamanhos e taxas antes de extrair. Lança ArchiveError se algo ultrapassar os limites. */
export function checkBudget(items: Array<{ name: string; size: number; compSize?: number }>, limits: Limits): void {
  const files = items.filter((i) => !i.name.endsWith('/'));
  if (files.length > limits.entries) throw new ArchiveError('too-many', `O pacote tem ${files.length} arquivos; o limite é ${limits.entries}.`);
  let total = 0;
  for (const f of files) {
    if (f.size > limits.entryBytes) throw new ArchiveError('too-big', `"${f.name}" tem ${MB(f.size)} descompactado; o limite por arquivo é ${MB(limits.entryBytes)}.`);
    if (f.compSize !== undefined && f.size > 10 * 1048576 && f.size / Math.max(1, f.compSize) > limits.ratio) {
      throw new ArchiveError('bomb', `"${f.name}" se expande ${Math.round(f.size / Math.max(1, f.compSize))} vezes. Parece um arquivo malicioso (zip-bomb) e não foi aberto.`);
    }
    total += f.size;
  }
  if (total > limits.totalBytes) throw new ArchiveError('too-big', `O conteúdo descompactado soma ${MB(total)}; o limite é ${MB(limits.totalBytes)}.`);
}

export function extractZip(b: Uint8Array, limits: Limits = LIMITS): Entry[] {
  const dir = readZipDirectory(b);
  if (dir.some((d) => d.flags & 1)) throw new ArchiveError('encrypted', 'Este arquivo ZIP está protegido por senha. Descompacte-o com a senha e importe novamente.');
  checkBudget(dir, limits);
  const allowed = new Map<string, string>();
  for (const d of dir) {
    if (d.name.endsWith('/')) continue;
    const p = safePath(d.name);
    if (p) allowed.set(d.name, p);
  }
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(b, { filter: (f) => allowed.has(f.name) && f.originalSize <= limits.entryBytes });
  } catch (e) {
    throw new ArchiveError('corrupt', `Não foi possível descompactar: ${e instanceof Error ? e.message : 'arquivo corrompido'}.`);
  }
  let total = 0;
  const out: Entry[] = [];
  for (const [name, data] of Object.entries(raw)) {
    total += data.length;
    // O cabeçalho pode mentir sobre o tamanho: confere o que realmente saiu.
    if (data.length > limits.entryBytes || total > limits.totalBytes) throw new ArchiveError('bomb', 'O conteúdo descompactado ultrapassou o limite declarado. Arquivo recusado.');
    out.push({ path: allowed.get(name)!, data });
  }
  return out;
}

export function extractTar(b: Uint8Array, limits: Limits = LIMITS): Entry[] {
  const out: Entry[] = [];
  const dec = new TextDecoder();
  let off = 0;
  let total = 0;
  let longName: string | null = null;
  const field = (o: number, len: number) => dec.decode(b.subarray(o, o + len)).replace(/\0[\s\S]*$/, '');
  while (off + 512 <= b.length) {
    if (b.subarray(off, off + 512).every((v) => v === 0)) break;
    const name = field(off, 100);
    const sizeStr = field(off + 124, 12).trim();
    const size = sizeStr ? parseInt(sizeStr, 8) : 0;
    if (!Number.isFinite(size) || size < 0) throw new ArchiveError('corrupt', 'Cabeçalho TAR inválido.');
    const type = String.fromCharCode(b[off + 156] ?? 0);
    const prefix = field(off + 345, 155);
    const dataStart = off + 512;
    if (dataStart + size > b.length) throw new ArchiveError('corrupt', 'O arquivo TAR está incompleto.');
    if (type === 'L') {
      longName = field(dataStart, size);
    } else if (type === '0' || type === '\0' || type === '7') {
      const fullName = longName ?? (prefix ? `${prefix}/${name}` : name);
      longName = null;
      if (out.length + 1 > limits.entries) throw new ArchiveError('too-many', `O pacote tem mais de ${limits.entries} arquivos.`);
      if (size > limits.entryBytes) throw new ArchiveError('too-big', `"${fullName}" é grande demais (${MB(size)}).`);
      total += size;
      if (total > limits.totalBytes) throw new ArchiveError('too-big', `O conteúdo soma mais de ${MB(limits.totalBytes)}.`);
      const p = safePath(fullName);
      if (p) out.push({ path: p, data: b.slice(dataStart, dataStart + size) });
    } else {
      longName = null; // diretórios, links e afins são ignorados
    }
    off = dataStart + Math.ceil(size / 512) * 512;
  }
  return out;
}

/** Descompacta GZIP em streaming, parando assim que passar do limite. */
export async function gunzip(b: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new ArchiveError('unsupported', 'Este navegador não descompacta GZIP.');
  const stream = new Blob([b as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ArchiveError('bomb', `O conteúdo compactado se expande além de ${MB(maxBytes)}. Arquivo recusado.`);
      }
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof ArchiveError) throw e;
    throw new ArchiveError('corrupt', 'O arquivo GZIP está corrompido.');
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Interface mínima do libarchive, para injetar um substituto em testes. */
export interface LibarchiveReader {
  open(file: Blob): Promise<{
    hasEncryptedData(): Promise<boolean | null>;
    getFilesArray(): Promise<Array<{ file: { name: string; size: number; extract(): Promise<Blob> }; path: string }>>;
    close?(): Promise<void>;
  }>;
}

let libarchive: Promise<LibarchiveReader> | null = null;

/** Carrega o leitor WASM só quando um 7z/RAR/XZ/BZIP2 aparece (≈1 MB, servido localmente). */
export function loadLibarchive(): Promise<LibarchiveReader> {
  if (!libarchive) {
    libarchive = (async () => {
      if (location.protocol === 'file:') throw new ArchiveError('unsupported', 'Para abrir 7z, RAR, XZ ou BZIP2, use o Recorte Studio pelo site ou instalado (PWA); aberto direto do disco o navegador bloqueia o leitor.');
      const mod = await import('libarchive.js');
      const Archive = mod.Archive;
      Archive.init({ workerUrl: new URL('vendor/libarchive/worker-bundle.js', document.baseURI).href });
      return { open: (file: Blob) => Archive.open(file as File) } as unknown as LibarchiveReader;
    })();
    libarchive.catch(() => { libarchive = null; });
  }
  return libarchive;
}

export async function extractWithLibarchive(file: Blob, reader: LibarchiveReader, limits: Limits = LIMITS): Promise<Entry[]> {
  let archive;
  try {
    archive = await reader.open(file);
  } catch {
    throw new ArchiveError('corrupt', 'Não foi possível ler este arquivo compactado. Ele pode estar corrompido ou usar uma variante não suportada.');
  }
  try {
    if ((await archive.hasEncryptedData()) === true) throw new ArchiveError('encrypted', 'Este arquivo está protegido por senha. Descompacte-o com a senha e importe novamente.');
    const list = await archive.getFilesArray();
    checkBudget(list.map((f) => ({ name: `${f.path}${f.file.name}`, size: f.file.size })), limits);
    const out: Entry[] = [];
    let total = 0;
    for (const f of list) {
      const p = safePath(`${f.path}${f.file.name}`);
      if (!p) continue;
      const blob = await f.file.extract();
      total += blob.size;
      if (blob.size > limits.entryBytes || total > limits.totalBytes) throw new ArchiveError('bomb', 'O conteúdo extraído ultrapassou o limite. Arquivo recusado.');
      out.push({ path: p, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    return out;
  } catch (e) {
    if (e instanceof ArchiveError) throw e;
    const msg = e instanceof Error ? e.message : '';
    if (/passphrase|password|encrypt/i.test(msg)) throw new ArchiveError('encrypted', 'Este arquivo está protegido por senha. Descompacte-o com a senha e importe novamente.');
    throw new ArchiveError('corrupt', 'Não foi possível extrair este arquivo compactado. Ele pode estar corrompido.');
  } finally {
    await archive.close?.().catch(() => undefined);
  }
}

const KIND_LABEL: Record<ArchiveKind, string> = {
  zip: 'ZIP', tar: 'TAR', gzip: 'GZIP', '7z': '7z', rar: 'RAR', xz: 'XZ', bzip2: 'BZIP2', json: 'JSON', unknown: 'desconhecido',
};
export const kindLabel = (k: ArchiveKind) => KIND_LABEL[k];

/**
 * Extrai qualquer formato suportado. `json` e `unknown` não passam por aqui.
 * O leitor WASM é injetável para testes.
 */
export async function extractArchive(file: Blob, opts: { limits?: Limits; reader?: () => Promise<LibarchiveReader> } = {}): Promise<{ kind: ArchiveKind; entries: Entry[] }> {
  const limits = opts.limits ?? LIMITS;
  if (file.size > limits.inputBytes) throw new ArchiveError('too-big', `O arquivo tem ${MB(file.size)}; o limite é ${MB(limits.inputBytes)}.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectKind(bytes);
  switch (kind) {
    case 'zip':
      return { kind, entries: extractZip(bytes, limits) };
    case 'tar':
      return { kind, entries: extractTar(bytes, limits) };
    case 'gzip': {
      const inner = await gunzip(bytes, limits.totalBytes);
      if (detectKind(inner) === 'tar') return { kind, entries: extractTar(inner, limits) };
      if (inner.length > limits.entryBytes) throw new ArchiveError('too-big', 'Conteúdo grande demais.');
      return { kind, entries: [{ path: 'conteudo', data: inner }] };
    }
    case '7z':
    case 'rar':
    case 'xz':
    case 'bzip2': {
      const reader = await (opts.reader ?? loadLibarchive)();
      return { kind, entries: await extractWithLibarchive(file, reader, limits) };
    }
    default:
      throw new ArchiveError('unsupported', 'Formato não reconhecido. Use .jrec, .zip, .7z, .rar, .tar, .tar.gz, .tar.xz, .tar.bz2 ou um projeto .json.');
  }
}
