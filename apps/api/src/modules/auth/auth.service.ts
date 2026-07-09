import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';

// Valid-format bcrypt hash with no known plaintext. Compared against when the
// email is unknown so response time doesn't leak which emails are registered.
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
