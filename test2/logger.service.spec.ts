import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'

import { LoggerService } from './logger.service'

describe('loggerService', () => {
  let loggerService: LoggerService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggerService],
    }).compile()

    loggerService = module.get<LoggerService>(LoggerService)
  })

  it('should log messages', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    loggerService.log('Test log')
    expect(logSpy).toHaveBeenCalledWith('Test log')

    logSpy.mockRestore()
  })
})
