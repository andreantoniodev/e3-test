import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DomainException } from '../exceptions/domain.exception';
import { GlobalHttpExceptionFilter } from './http-exception.filter';

class MockDomainException extends DomainException {
  constructor() {
    super('Erro de teste de domínio', HttpStatus.BAD_REQUEST);
  }
}

describe('GlobalHttpExceptionFilter', () => {
  const filter = new GlobalHttpExceptionFilter();

  function mockHost() {
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const responseMock = { status: statusMock };
    const requestMock = { url: '/test-path' };

    const hostMock = {
      switchToHttp: () => ({
        getResponse: () => responseMock,
        getRequest: () => requestMock,
      }),
    } as unknown as ArgumentsHost;

    return { hostMock, statusMock, jsonMock };
  }

  it('formata exceção de domínio em JSON estruturado', () => {
    const { hostMock, statusMock, jsonMock } = mockHost();
    const exception = new MockDomainException();

    filter.catch(exception, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'MockDomain',
        message: 'Erro de teste de domínio',
        path: '/test-path',
      }),
    );
  });

  it('trata erros genéricos com status 500', () => {
    const { hostMock, statusMock, jsonMock } = mockHost();
    const exception = new Error('Falha inesperada');

    filter.catch(exception, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Ocorreu um erro interno no servidor.',
      }),
    );
  });
});
