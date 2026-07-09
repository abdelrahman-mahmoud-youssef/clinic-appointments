import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.authRepository.findByEmail(email);
    const isValid = user ? await bcrypt.compare(password, user.hashedPassword) : false;

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
