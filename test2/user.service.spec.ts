import type { TestingModule } from '@nestjs/testing'

import type { CreateUserDto } from '../dto/create-user.dto'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import * as bcrypt from 'bcrypt'
import { Repository } from 'typeorm'
import { ProductNotFoundError } from '../../common/errors/product-not-found.error'
import { UserEntity } from '../entities/user.entity'
import { UserService } from './user.service'

jest.mock('bcrypt')

describe('userService', () => {
  let service: UserService
  let repository: Repository<UserEntity>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(UserEntity),
          useClass: Repository,
        },
      ],
    }).compile()

    service = module.get<UserService>(UserService)
    repository = module.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('createUser', () => {
    it('should create a user with hashed password', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      }

      const hashedPassword = 'hashedPassword123';

      // Mock bcrypt.hash to return the hashed password
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword)

      const savedUser = {
        id: 'uuid',
        ...createUserDto,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Mock repository.create and repository.save
      jest.spyOn(repository, 'create').mockReturnValue(savedUser as any)
      jest.spyOn(repository, 'save').mockResolvedValue(savedUser as any)

      const result = await service.createUser(createUserDto)

      expect(result).toHaveProperty('id', 'uuid')
      expect(result.email).toBe(createUserDto.email)
      expect(result.name).toBe(createUserDto.name)
      expect(result).not.toHaveProperty('password') // Ensure password is not returned
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10) // Check bcrypt was called correctly
    })
  })

  describe('getUserById', () => {
    it('should return a user by id', async () => {
      const user = {
        id: 'uuid',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(user as any)

      const result = await service.getUserById('uuid')
      expect(result).toEqual(user)
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'uuid' })
    })

    it('should throw ProductNotFoundError if user not found', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(null)

      await expect(service.getUserById('non-existent-id')).rejects.toThrow(
        ProductNotFoundError,
      )
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'non-existent-id' })
    })
  })

  // Additional tests for other methods like updateUser, deleteUser can be added here
})
