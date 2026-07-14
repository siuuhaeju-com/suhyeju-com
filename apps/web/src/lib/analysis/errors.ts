export type AnalysisErrorCode =
  | 'INVALID_ANALYSIS_INPUT'
  | 'ARTICLE_EXTRACTION_FAILED'
  | 'MODEL_RESPONSE_PARSE_FAILED'
  | 'ANALYSIS_CONTRACT_VIOLATION'
  | 'ANALYSIS_ASSEMBLY_FAILED';

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;
  readonly userMessage: string;
  readonly details?: string[];

  constructor({
    code,
    message,
    userMessage,
    details,
    cause,
  }: {
    code: AnalysisErrorCode;
    message: string;
    userMessage?: string;
    details?: string[];
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = new.target.name;
    this.code = code;
    this.userMessage = userMessage ?? message;
    this.details = details;
  }
}

export class InvalidAnalysisInputError extends AnalysisError {
  constructor(message: string) {
    super({
      code: 'INVALID_ANALYSIS_INPUT',
      message,
      userMessage: message,
    });
  }
}

export class ArticleExtractionError extends AnalysisError {
  constructor(message = '뉴스 본문을 불러오지 못했습니다.') {
    super({
      code: 'ARTICLE_EXTRACTION_FAILED',
      message,
      userMessage: '뉴스 본문을 불러오지 못했습니다. 기사 본문을 붙여넣어 다시 시도해주세요.',
    });
  }
}

export class ModelResponseParseError extends AnalysisError {
  constructor(message = 'GPT 분석 결과 파싱에 실패했습니다', cause?: unknown) {
    super({
      code: 'MODEL_RESPONSE_PARSE_FAILED',
      message,
      userMessage: 'AI 분석 결과 형식이 올바르지 않습니다. 잠시 후 다시 시도해주세요.',
      cause,
    });
  }
}

export class AnalysisContractError extends AnalysisError {
  constructor(scope: 'draft' | 'result', details: string[]) {
    super({
      code: 'ANALYSIS_CONTRACT_VIOLATION',
      message: `${scope === 'draft' ? 'GPT 분석 초안' : '분석 결과'} 계약 위반: ${details.join(' / ')}`,
      userMessage: '분석 결과 구조가 올바르지 않습니다. 잠시 후 다시 시도해주세요.',
      details,
    });
  }
}

export class AnalysisAssemblyError extends AnalysisError {
  constructor(message = '분석 결과 조립에 실패했습니다', cause?: unknown) {
    super({
      code: 'ANALYSIS_ASSEMBLY_FAILED',
      message,
      userMessage: '분석 결과를 완성하지 못했습니다. 잠시 후 다시 시도해주세요.',
      cause,
    });
  }
}

export function getAnalysisErrorMessage(error: unknown): string {
  if (error instanceof AnalysisError) {
    return error.userMessage;
  }

  return error instanceof Error ? error.message : '분석에 실패했습니다';
}
