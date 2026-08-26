export type VerificationSource = 'WEB' | 'MOBILE';

export function detectVerificationSource(deviceID: string): VerificationSource {
  return deviceID.toUpperCase().startsWith('WEB-') ? 'WEB' : 'MOBILE';
}

export function buildVerificationSourceFilterClause(paramIndex: number) {
  return `($${paramIndex} = 'WEB' AND "deviceID" LIKE 'WEB-%') OR ($${paramIndex} = 'MOBILE' AND "deviceID" NOT LIKE 'WEB-%')`;
}

export function verificationSourceSqlExpression() {
  return `CASE WHEN "deviceID" LIKE 'WEB-%' THEN 'WEB' ELSE 'MOBILE' END`;
}