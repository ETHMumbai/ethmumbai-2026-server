import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const providedKey = (req.header('x-api-key') || '') as string;

    // read allowed key from env
    const allowed = process.env.AUTH_API_KEY || '';

    if (!providedKey || !allowed.includes(providedKey)) {
      throw new UnauthorizedException(
        'The BEST Conference is waiting for you! Use this ticket at the check-in. See you there!',
      );
    }
    return true;
  }
}
