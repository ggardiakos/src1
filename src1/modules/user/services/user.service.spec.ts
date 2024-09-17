import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { NotFoundException } from '@nestjs/common';

const mockUser = {
  id: '123',
  username: 'testuser',
  email: 'testuser@example.com',
  firstName: 'Test',
  lastName: 'User',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserRepository = {
  findOne: jest.fn().mockResolvedValue(mockUser),
  save: jest.fn().mockResolvedValue(mockUser),
  update: jest.fn().mockResolvedValue(mockUser),
};

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserById', () => {
    it('should return a user by ID', async () => {
      const result = await service.getUserById('123');
      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '123' } });
    });

    it('should throw a NotFoundException if the user is not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);
      await expect(service.getUserById('123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUser', () => {
    it('should update and return the user', async () => {
      const updateData = { firstName: 'Updated' };
      const result = await service.updateUser('123', updateData);
      expect(result).toEqual(mockUser);
      expect(repository.update).toHaveBeenCalledWith('123', updateData);
    });

    it('should throw a NotFoundException if the user to update is not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);
      const updateData = { firstName: 'Updated' };
      await expect(service.updateUser('123', updateData)).rejects.toThrow(NotFoundException);
    });
  });
});
