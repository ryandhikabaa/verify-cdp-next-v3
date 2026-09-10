import {Prisma} from '@prisma/client';
import type {PatternGenerated} from '@prisma/client';
import type {PatternDoc} from '@/lib/types';
import {prisma} from '@/lib/db/prisma';

export type PatternListDoc = PatternDoc & {
  record_id: string;
};

export type PatternListRow = Omit<PatternGenerated, 'imageData' | 'imageBlob'>;

/** List payload never carries image blobs; images load on demand via /image. */
export function mapPatternGeneratedToListDoc(row: PatternListRow): PatternListDoc {
  return {
    id: row.patternPayload,
    record_id: row.id,
    label: row.patternPayload,
    density: row.density,
    size: row.size ?? undefined,
    style: row.style ?? undefined,
    payload: row.patternPayload,
    payload_1: row.patternPayload,
    payload_qr: row.qrPayload,
    qr_payload: row.qrPayload,
    qr_hvalue: row.qrHvalue,
    qr_secret1: row.qrSecret1,
    qr_secret2: row.qrSecret2,
    qr_image: row.qrImage,
    pattern_payload: row.patternPayload,
    layout_version: row.layoutVersion,
    qr_width_px: row.qrWidthPx ?? undefined,
    qr_height_px: row.qrHeightPx ?? undefined,
    pattern_width_px: row.patternWidthPx ?? undefined,
    pattern_height_px: row.patternHeightPx ?? undefined,
    gap_px: row.gapPx ?? undefined,
    canvas_width_px: row.canvasWidthPx ?? undefined,
    canvas_height_px: row.canvasHeightPx ?? undefined,
    scanned_count: row.scannedCount,
    authentic_count: row.authenticCount,
    counterfeit_count: row.counterfeitCount,
    created_at: row.createAt.toISOString(),
    updated_at: row.updateAt.toISOString(),
  };
}

export const PATTERN_LIST_SELECT = {
  id: true,
  qrPayload: true,
  qrHvalue: true,
  qrSecret1: true,
  qrSecret2: true,
  qrImage: true,
  patternPayload: true,
  density: true,
  size: true,
  style: true,
  layoutVersion: true,
  qrWidthPx: true,
  qrHeightPx: true,
  patternWidthPx: true,
  patternHeightPx: true,
  gapPx: true,
  canvasWidthPx: true,
  canvasHeightPx: true,
  scannedCount: true,
  authenticCount: true,
  counterfeitCount: true,
  createAt: true,
  updateAt: true,
} satisfies Prisma.PatternGeneratedSelect;

/** Builds the shared Prisma where clause for search and day filters. */
export function buildPatternListWhere(params: {search?: string; day?: string}): Prisma.PatternGeneratedWhereInput {
  const where: Prisma.PatternGeneratedWhereInput = {};

  const search = params.search?.trim().toUpperCase();
  if (search) {
    where.OR = [
      {patternPayload: {contains: search, mode: 'insensitive'}},
      {qrPayload: {contains: search, mode: 'insensitive'}},
      {qrHvalue: {contains: search, mode: 'insensitive'}},
      {style: {contains: search, mode: 'insensitive'}},
    ];
  }

  if (params.day) {
    const dayStart = new Date(`${params.day}T00:00:00`);
    if (!Number.isNaN(dayStart.getTime())) {
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      where.createAt = {gte: dayStart, lt: dayEnd};
    }
  }

  return where;
}

/** Prisma has no string-length filter, so exact-length seeds resolve via raw SQL. */
export async function querySeedLengthPayloads(params: {
  seedLength: number;
  search: string;
  day: string;
  sort: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}): Promise<{payloads: string[]; total: number}> {
  const conditions: Prisma.Sql[] = [Prisma.sql`CHAR_LENGTH(pattern_payload) = ${params.seedLength}`];

  const search = params.search.trim().toUpperCase();
  if (search) {
    const like = `%${search}%`;
    conditions.push(Prisma.sql`(pattern_payload ILIKE ${like} OR qr_payload ILIKE ${like} OR qr_hvalue ILIKE ${like} OR style ILIKE ${like})`);
  }

  if (params.day) {
    const dayStart = new Date(`${params.day}T00:00:00`);
    if (!Number.isNaN(dayStart.getTime())) {
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      conditions.push(Prisma.sql`(create_at >= ${dayStart} AND create_at < ${dayEnd})`);
    }
  }

  const whereSql = Prisma.join(conditions, ' AND ');
  const orderBySql = params.sort === 'asc'
    ? Prisma.sql`ORDER BY create_at ASC, pattern_payload ASC`
    : Prisma.sql`ORDER BY create_at DESC, pattern_payload ASC`;
  const limitSql = params.page && params.pageSize
    ? Prisma.sql`LIMIT ${params.pageSize} OFFSET ${(params.page - 1) * params.pageSize}`
    : Prisma.empty;

  const [payloadRows, countRows] = await prisma.$transaction([
    prisma.$queryRaw<{pattern_payload: string}[]>`
      SELECT pattern_payload FROM pattern_generated
      WHERE ${whereSql} ${orderBySql} ${limitSql}`,
    prisma.$queryRaw<{count: number}[]>`
      SELECT COUNT(*)::int AS count FROM pattern_generated WHERE ${whereSql}`,
  ]);

  return {
    payloads: payloadRows.map((row) => row.pattern_payload),
    total: countRows[0]?.count ?? 0,
  };
}

/** Loads one paginated catalog page, routing exact-length seeds through raw SQL. */
export async function loadPatternListPage(params: {
  seedLength: number;
  search: string;
  day: string;
  sort: 'asc' | 'desc';
  page: number;
  pageSize: number;
}): Promise<{rows: PatternListRow[]; total: number; totalAll: number}> {
  if (params.seedLength > 0) {
    const {payloads, total} = await querySeedLengthPayloads(params);
    const dbRows = payloads.length > 0
      ? await prisma.patternGenerated.findMany({
          where: {patternPayload: {in: payloads}},
          select: PATTERN_LIST_SELECT,
        })
      : [];
    const byPayload = new Map(dbRows.map((row) => [row.patternPayload, row]));
    const rows = payloads
      .map((payload) => byPayload.get(payload))
      .filter((row): row is PatternListRow => row !== undefined);
    const totalAll = await prisma.patternGenerated.count();
    return {rows, total, totalAll};
  }

  const where = buildPatternListWhere({search: params.search, day: params.day});
  const [rows, filteredCount, totalAll] = await prisma.$transaction([
    prisma.patternGenerated.findMany({
      where,
      select: PATTERN_LIST_SELECT,
      orderBy: [{createAt: params.sort}, {patternPayload: 'asc'}],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.patternGenerated.count({where}),
    prisma.patternGenerated.count(),
  ]);
  return {rows, total: filteredCount, totalAll};
}

export function mapPatternGeneratedToDetailDoc(row: PatternGenerated): PatternListDoc & {
  qr_hvalue: string;
  qr_secret1: string;
  qr_secret2: string;
  qr_image: string;
} {
  return {
    ...mapPatternGeneratedToListDoc(row),
    qr_hvalue: row.qrHvalue,
    qr_secret1: row.qrSecret1,
    qr_secret2: row.qrSecret2,
    qr_image: row.qrImage,
  };
}
