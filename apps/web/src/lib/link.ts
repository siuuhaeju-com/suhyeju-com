/** F-01 링크 형식 검증 — http(s):// + 도메인 형태만 확인, 실제 접속 여부는 검사하지 않는다 */
export function isValidNewsLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.');
  } catch {
    return false;
  }
}
