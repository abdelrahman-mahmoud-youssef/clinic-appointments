import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';

// A valid-format bcrypt hash of no known password. Compared against on a
// missing user so a nonexistent email takes the same time as a wrong
// password, rather than returning early and leaking which emails exist.
const DUMMY_HASH = '$2b$10$A9eJ.PLI0Y9ys6j4vyK2M.0Jdr7UQYarixwnQ49auEkfWatgts9vS';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.authRepository.findByEmail(email);
    const isValid = await bcrypt.compare(password, user?.hashedPassword ?? DUMMY_HASH);

    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      clinicId: user.clinicId,
      role: user.role,
    });

    return { accessToken };
  }
}
