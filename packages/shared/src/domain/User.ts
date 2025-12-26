import { Result } from './Track';

/**
 * User value object representing a party guest
 * Requirements: 6.3
 */
export interface User {
  readonly id: string;
  readonly nickname: string;
}

/**
 * User creation data for validation
 */
export interface UserCreateData {
  id: string;
  nickname: string;
}

/**
 * User-related error types
 */
export type UserError = 
  | 'INVALID_ID'
  | 'INVALID_NICKNAME';

/**
 * User validation and creation functions
 */
export class UserValidator {
  static validateId(id: string): boolean {
    return typeof id === 'string' && id.trim().length > 0;
  }

  static validateNickname(nickname: string): boolean {
    return typeof nickname === 'string' && nickname.trim().length > 0;
  }

  static create(data: UserCreateData): Result<User, UserError> {
    if (!this.validateId(data.id)) {
      return { success: false, error: 'INVALID_ID' };
    }

    if (!this.validateNickname(data.nickname)) {
      return { success: false, error: 'INVALID_NICKNAME' };
    }

    const user: User = {
      id: data.id.trim(),
      nickname: data.nickname.trim()
    };

    return { success: true, value: user };
  }
}

// Re-export Result type for convenience
export type { Result } from './Track';